"""Factory meters, period readings and distribution of annual carbon budgets."""
from datetime import date
from decimal import Decimal
from typing import Annotated,Literal
from fastapi import APIRouter,Depends,HTTPException
from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy import func
from sqlalchemy.orm import Session
from ..database import get_db
from ..deps import check_company_access,get_current_user
from ..models import BusinessRecord,User
from ..models.enterprise import EmissionBudget
from ..models.enterprise_domains import BudgetAllocation,MeasurementUnit,MeteringPoint,UnitConversion
from ..models.organization import ReportingPeriod,Site
from ..schemas import RecordCreate
from ..services.inventory import lock_company
from ..services.organization import is_company_admin,require_company_admin,require_period_location,validate_location
from .inventory import require_period
from .records import write_record

router=APIRouter(prefix="/factory",tags=["工厂计量与预算"])
Month=Annotated[str,StringConstraints(pattern=r"^[1-9][0-9]{3}-(0[1-9]|1[0-2])$")]
PowerUnit=Literal["Wh","kWh","MWh"]


class MeterInput(BaseModel):
    code: Annotated[str,StringConstraints(strip_whitespace=True,to_upper=True,pattern=r"^[A-Z0-9_-]{2,32}$")]
    site_id:int
    unit:PowerUnit
    installed_on:date


class Reading(BaseModel):
    month:Month
    consumed:Decimal=Field(gt=0,max_digits=18,decimal_places=4)
    factor_id:Annotated[str,StringConstraints(strip_whitespace=True,min_length=1,max_length=64)]


class Limit(BaseModel):
    month:Month
    site_id:int
    amount:Decimal=Field(gt=0,max_digits=20,decimal_places=4)


@router.get("/{cid}")
def workspace(cid:int,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    check_company_access(db,user,cid)
    meters=db.query(MeteringPoint,Site.name,MeasurementUnit.ucum_code).join(Site,Site.id==MeteringPoint.site_id).join(
        MeasurementUnit,MeasurementUnit.id==MeteringPoint.default_unit_id).filter(MeteringPoint.tenant_id==cid)
    from ..models.inventory import InventoryPeriod
    budgets=db.query(BudgetAllocation,InventoryPeriod.period,Site.name).join(
        InventoryPeriod,InventoryPeriod.id==BudgetAllocation.period_id).join(Site,Site.id==BudgetAllocation.site_id).filter(
            BudgetAllocation.tenant_id==cid).order_by(InventoryPeriod.period.desc(),Site.name)
    return {"can_manage":is_company_admin(db,user,cid),"meters":[{"id":v.id,"code":v.meter_code,"site":s,"unit":u,
            "installed_on":v.installed_on} for v,s,u in meters.order_by(Site.name,MeteringPoint.meter_code)],
            "budgets":[{"id":v.id,"site":s,"period":month,"amount":v.amount_kgco2e} for v,month,s in budgets]}


@router.post("/{cid}/meters",status_code=201)
def add_meter(cid:int,p:MeterInput,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    require_company_admin(db,user,cid)
    lock_company(db,cid)
    validate_location(db,cid,p.site_id,None)
    if db.query(MeteringPoint.id).filter_by(tenant_id=cid,site_id=p.site_id,meter_code=p.code).first():
        raise HTTPException(409,"同工厂已经登记此表计")
    unit=db.query(MeasurementUnit).filter_by(ucum_code=p.unit,dimension="energy").one()
    row=MeteringPoint(tenant_id=cid,site_id=p.site_id,meter_code=p.code,medium="electricity",default_unit_id=unit.id,installed_on=p.installed_on)
    db.add(row)
    db.commit()
    return {"id":row.id}


@router.post("/{cid}/meters/{meter_id}/readings",status_code=201)
def read_meter(cid:int,meter_id:int,p:Reading,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    check_company_access(db,user,cid,write=True)
    lock_company(db,cid)
    meter=db.query(MeteringPoint).filter_by(tenant_id=cid,id=meter_id).first()
    if not meter or p.month < meter.installed_on.isoformat()[:7] or (meter.retired_on and p.month > meter.retired_on.isoformat()[:7]):
        raise HTTPException(422,"请选择该月份在用的本企业表计")
    unit=db.get(MeasurementUnit,meter.default_unit_id)
    kwh=db.query(MeasurementUnit).filter_by(ucum_code="kWh").one()
    multiplier=Decimal(1)
    if unit.id!=kwh.id:
        effective=date.fromisoformat(p.month+"-01")
        conversion=db.query(UnitConversion).filter(UnitConversion.from_unit_id==unit.id,UnitConversion.to_unit_id==kwh.id,
            UnitConversion.valid_start<=effective,(UnitConversion.valid_end.is_(None))|(UnitConversion.valid_end>=effective)).one_or_none()
        if not conversion:
            raise HTTPException(422,"表计读数没有对应期间的 kWh 换算规则")
        multiplier=conversion.multiplier
    record_no=f"M-{cid}-{meter.id}-{p.month}"
    old=db.query(BusinessRecord).filter_by(company_id=cid,record_no=record_no).first()
    if old:
        from ..models.organization import ActivityRevision
        first=db.query(ActivityRevision).filter_by(record_id=old.id,tenant_id=cid,revision_no=1).first()
        if first is None:
            raise HTTPException(409,"同表计月份已占用")
        original=first.snapshot
        if original.get("meter_id")==meter.id and Decimal(original["source_quantity"])==p.consumed and original.get("factor_id")==p.factor_id:
            return {"record_no":record_no,"replayed":True}
        raise HTTPException(409,"该月已登记用电量，请在原台账中更正")
    payload=RecordCreate(company_id=cid,record_no=record_no,period=p.month,category="electricity",scope="scope2",
        quantity=float(p.consumed*multiplier),unit="kWh",site_id=meter.site_id,factor_id=p.factor_id,source="manual",review_status="pending")
    return write_record(payload,db,user,reading={"meter_id":meter.id,"meter_code":meter.meter_code,"source_quantity":str(p.consumed),
                       "meter_unit":unit.ucum_code,"multiplier_to_kwh":str(multiplier)})


@router.post("/{cid}/allocations")
def allocate(cid:int,p:Limit,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    require_company_admin(db,user,cid)
    lock_company(db,cid)
    validate_location(db,cid,p.site_id,None)
    period=require_period(db,cid,p.month)
    if period.status!="open" or not db.get(ReportingPeriod,period.id):
        raise HTTPException(409,"请选择已设置组织边界且尚未送审的月份")
    require_period_location(db,cid,p.month,p.site_id)
    year=int(p.month[:4])
    budget=db.query(EmissionBudget).filter_by(company_id=cid,year=year).with_for_update().first()
    if not budget:
        raise HTTPException(409,"请先在排放驾驶舱设置本年度排放预算")
    row=db.query(BudgetAllocation).filter_by(tenant_id=cid,period_id=period.id,site_id=p.site_id,scenario_basis="operating").first()
    distributed=db.query(func.sum(BudgetAllocation.amount_kgco2e)).filter_by(tenant_id=cid,budget_year=year).scalar() or 0
    if distributed-(row.amount_kgco2e if row else 0)+p.amount > Decimal(str(budget.annual_limit_kgco2e)):
        raise HTTPException(409,"各工厂月度分解金额之和超过年度排放预算")
    if not row:
        row=BudgetAllocation(tenant_id=cid,budget_year=year,period_id=period.id,site_id=p.site_id,scenario_basis="operating")
        db.add(row)
    row.amount_kgco2e=p.amount
    db.commit()
    return {"id":row.id,"amount":row.amount_kgco2e}
