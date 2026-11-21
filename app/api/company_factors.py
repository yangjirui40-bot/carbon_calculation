"""Publish evidence-based enterprise factors without changing historic versions."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from algorithm_pkg.models.core import CUSTOM_UNITS, SCOPE_BY_CATEGORY
from ..database import get_db
from ..deps import check_company_access, get_current_user
from ..models import EmissionFactor, User
from ..models.company_factors import CompanyFactorVersion, FactorSource
from ..services.inventory import lock_company
from ..services.organization import is_company_admin, require_company_admin
from .factors import _to_dict

router = APIRouter(prefix="/company-factors", tags=["企业因子"])
Month = Annotated[str, StringConstraints(pattern=r"^[1-9][0-9]{3}-(0[1-9]|1[0-2])$")]
Note = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=600)]


from decimal import Decimal
from ..services.factor_basis import edition
from ..models.enterprise_domains import FactorGasComponent, PriceIndex

class PublishFactor(BaseModel):
    series: Annotated[str, StringConstraints(pattern=r"^[A-Z0-9][A-Z0-9_-]{1,23}$")]
    category: str = Field(max_length=48)
    activity_unit: str = Field(max_length=16)
    components: dict[str,Annotated[Decimal,Field(ge=0,max_digits=18,decimal_places=10)]] | None = None
    value: float | None = Field(None,ge=0, le=1e9, allow_inf_nan=False)
    valid_from: Month
    valid_to: Month | None = None
    publisher: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]
    citation: Note
    gas_coverage: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=80)]
    methodology: Note
    price_basis: str | None = Field(None,max_length=64)


@router.get("/{company_id}")
def versions(company_id:int, db:Session=Depends(get_db), user:User=Depends(get_current_user)):
    check_company_access(db,user,company_id)
    rows = db.query(CompanyFactorVersion, EmissionFactor, FactorSource).join(
        EmissionFactor, EmissionFactor.id==CompanyFactorVersion.emission_factor_id
    ).join(FactorSource, FactorSource.id==CompanyFactorVersion.source_id).filter(
        CompanyFactorVersion.tenant_id==company_id
    ).order_by(CompanyFactorVersion.id.desc()).all()
    return {"can_publish":is_company_admin(db,user,company_id),"entries":[
        {**_to_dict(factor),"series":version.series,"valid_from":version.valid_from,"valid_to":version.valid_to,
         "publisher":source.publisher,"citation":source.citation,"coverage":source.gas_coverage}
        for version,factor,source in rows]}


@router.post("/{company_id}", status_code=201)
def publish(company_id:int, payload:PublishFactor, db:Session=Depends(get_db), user:User=Depends(get_current_user)):
    require_company_admin(db,user,company_id)
    lock_company(db,company_id)
    if payload.category not in CUSTOM_UNITS or payload.activity_unit not in CUSTOM_UNITS[payload.category]:
        raise HTTPException(422,"当前类别与活动单位不匹配")
    if payload.valid_to and payload.valid_to < payload.valid_from:
        raise HTTPException(422,"有效截止月不得早于起始月")
    if payload.activity_unit=="CNY" and not (payload.price_basis or "").strip():
        raise HTTPException(422,"金额法需要填写币种与价格年度及金额口径")
    same = db.query(CompanyFactorVersion).filter_by(tenant_id=company_id,series=payload.series)
    if payload.valid_to:
        same_window = same.filter(CompanyFactorVersion.valid_from<=payload.valid_to)
    else:
        same_window = same
    if same_window.filter(or_(CompanyFactorVersion.valid_to.is_(None),CompanyFactorVersion.valid_to>=payload.valid_from)).first():
        raise HTTPException(409,"同一因子序列不能有重叠的有效期。请使用有效截止月或新序列")
    number = same.with_entities(func.max(CompanyFactorVersion.version_no)).scalar() or 0
    gwp,weights=edition(db)
    decomposition=payload.components
    coefficient=payload.value
    coverage=payload.gas_coverage
    if decomposition is not None:
        if not decomposition or set(decomposition)-weights.keys() or coefficient is not None:
            raise HTTPException(422,"分气体模式须选择已登记气体，综合系数由系统计算")
        coefficient=float(sum(value*weights[gas] for gas,value in decomposition.items()))
        if coefficient>1e9:
            raise HTTPException(422,"折算后的每单位排放量超出支持范围")
        coverage=" + ".join(sorted(decomposition))+" / AR6 GWP100"
    elif coefficient is None:
        raise HTTPException(422,"请提供综合系数或每单位各气体质量")
    factor = EmissionFactor(factor_id=f"TEN_{company_id}_{payload.series}_{number+1}",category=payload.category,
        scope=SCOPE_BY_CATEGORY[payload.category],value=coefficient,unit=f"kgCO2e/{payload.activity_unit}",
        version=f"企业来源 v{number+1}",origin=f"{payload.publisher} · {payload.citation}"[:255],price_basis=payload.price_basis,
        is_demo=False,description=payload.methodology)
    source=FactorSource(tenant_id=company_id,publisher=payload.publisher,citation=payload.citation,
                        gas_coverage=coverage,methodology=payload.methodology)
    db.add_all([factor,source]);db.flush()
    version=CompanyFactorVersion(tenant_id=company_id,emission_factor_id=factor.id,source_id=source.id,
        series=payload.series,version_no=number+1,valid_from=payload.valid_from,
        valid_to=payload.valid_to,published_by=user.id)
    db.add(version)
    db.flush()
    if decomposition is None and coverage.strip().upper().replace("₂","2")=="CO2":
        decomposition={"CO2":coefficient}
    if decomposition:
        db.add_all(FactorGasComponent(tenant_id=company_id,factor_version_id=version.id,gas_code=gas,
                   kg_per_base_unit=value,gwp_set_id=gwp.id if payload.components else None) for gas,value in decomposition.items())
    db.commit()
    return _to_dict(factor)


class PriceBasis(BaseModel):
    source_year:int=Field(ge=1900,le=2200)
    target_year:int=Field(ge=1900,le=2200)
    region_code:Annotated[str,StringConstraints(strip_whitespace=True,min_length=2,max_length=48)]
    multiplier:Decimal=Field(gt=0,max_digits=18,decimal_places=10)
    publisher:Annotated[str,StringConstraints(strip_whitespace=True,min_length=2,max_length=120)]
    citation:Note

@router.get("/{company_id}/bases")
def bases(company_id:int,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    check_company_access(db,user,company_id)
    gwp,weights=edition(db)
    entries=db.query(PriceIndex,FactorSource).join(FactorSource,FactorSource.id==PriceIndex.source_id).filter(
        PriceIndex.tenant_id==company_id).order_by(PriceIndex.id.desc())
    return {"gwp":{"edition":gwp.edition_code,"reference":gwp.citation,"weights":weights},
            "prices":[{"id":v.id,"source_year":v.source_year,"target_year":v.target_year,"region":v.region_code,
                       "multiplier":v.multiplier,"publisher":src.publisher,"citation":src.citation} for v,src in entries]}

@router.post("/{company_id}/prices",status_code=201)
def price(company_id:int,p:PriceBasis,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    require_company_admin(db,user,company_id)
    lock_company(db,company_id)
    if p.source_year==p.target_year:
        raise HTTPException(422,"同年金额直接使用对应的数据版本")
    source=FactorSource(tenant_id=company_id,publisher=p.publisher,citation=p.citation,methodology="CNY producer-price conversion",gas_coverage="not applicable")
    db.add(source)
    db.flush()
    row=PriceIndex(tenant_id=company_id,source_id=source.id,source_year=p.source_year,target_year=p.target_year,
                   region_code=p.region_code,basis="CNY_producer_price",multiplier=p.multiplier)
    db.add(row)
    db.commit()
    return {"id":row.id}
