"""Capture BOM inputs for repeatable product carbon-footprint studies."""
import calendar
import hashlib
import json
from datetime import date
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import check_company_access, get_current_user
from ..models import CalculationRun, Product, User
from ..models.inventory import InventoryPeriod
from ..models.product_versions import BomVersion, PcfAllocation, ProductStudy
from ..services import load_factors_from_db
from ..services.calculation_service import _load_product_payload, run_product
from ..services.inventory import lock_company

router = APIRouter(prefix="/product-studies", tags=["产品足迹版本"])
Note = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=1500)]


class AllocationInput(BaseModel):
    run_id: str
    record_no: str
    share_ratio: Decimal = Field(gt=0, le=1, max_digits=9, decimal_places=8)
    reason: Note


class StudyInput(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=100)]
    start_on: date
    end_on: date
    boundary_note: Note
    allocations: list[AllocationInput] = Field(default_factory=list, max_length=100)


def product_for(db, user, product_id, write=False):
    product = db.query(Product).filter_by(product_id=product_id).first()
    if product is None:
        raise HTTPException(404, "产品不存在")
    check_company_access(db, user, product.company_id, write=write)
    return product


def study_info(row, version):
    return {"id": row.id, "version_no": version.version_no, "name": row.name, "start_on": row.start_on.isoformat(),
            "end_on": row.end_on.isoformat(), "boundary_note": row.boundary_note, "digest": version.digest,
            "items_count": len(version.content["bom_items"]), "created_at": version.created_at.isoformat()}


@router.get("/{product_id}")
def studies(product_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    product = product_for(db, user, product_id)
    rows = db.query(ProductStudy, BomVersion).join(BomVersion, BomVersion.id==ProductStudy.bom_version_id).filter(
        BomVersion.product_id == product.id, ProductStudy.tenant_id == product.company_id
    ).order_by(BomVersion.version_no.desc()).all()
    return [study_info(study, version) for study, version in rows]


def allocation_row(db, company_id, study, item):
    entry = db.query(CalculationRun).join(InventoryPeriod, InventoryPeriod.run_id == CalculationRun.run_id).filter(
        CalculationRun.run_id == item.run_id, CalculationRun.company_id == company_id,
        CalculationRun.operation == "enterprise", CalculationRun.status == "success",
        InventoryPeriod.company_id == company_id, InventoryPeriod.status == "closed"
    ).first()
    if not entry:
        raise HTTPException(422, "生产分摊只能引用本企业已关账快照")
    row = next((value for value in (entry.result or {}).get("items", []) if value["record_id"]==item.record_no), None)
    if not row or row["scope"] not in {"scope1","scope2"} or row.get("is_demo") or row.get("consolidation_share",1) != 1:
        raise HTTPException(422, "选择实际、未按股权缩放且属于范围 1 或 2 的已关账生产活动")
    month = date.fromisoformat(row["period"]+"-01")
    last = month.replace(day=calendar.monthrange(month.year,month.month)[1])
    if month < study.start_on or last > study.end_on:
        raise HTTPException(422, "活动月份需完整落在产品研究参考期间内")
    emissions = Decimal(str(row["emissions_kgco2e"])) * item.share_ratio
    return PcfAllocation(study_id=study.id, inventory_run_id=item.run_id, record_no=item.record_no,
                         emissions_kgco2e=emissions.quantize(Decimal("0.000001")), item_snapshot=row,
                         share_ratio=item.share_ratio, reason=item.reason)


@router.post("/{product_id}", status_code=201)
def capture_study(product_id: str, payload: StudyInput, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    product = product_for(db, user, product_id, write=True)
    lock_company(db, product.company_id)
    if payload.end_on < payload.start_on or len({item.record_no for item in payload.allocations}) != len(payload.allocations):
        raise HTTPException(422, "请核对参考期间，且同一活动在一版研究中只能分摊一次")
    envelope, bom = _load_product_payload(db, product_id)
    used = {row.get("matched_factor_id") for row in bom}
    factors = load_factors_from_db(db, company_id=product.company_id)
    if not used.issubset(factors):
        raise HTTPException(409, "请先在产品详情完成 BOM 因子复核")
    first, last = payload.start_on.isoformat()[:7], payload.end_on.isoformat()[:7]
    if any(factors[key].get("valid_from") and
           (factors[key]["valid_from"] > first or (factors[key].get("valid_to") and factors[key]["valid_to"] < last))
           for key in used):
        raise HTTPException(422, "有企业因子版本没有覆盖完整研究期间")
    content = {"product": envelope, "bom_items": bom, "factors": {key: factors[key] for key in sorted(used)}}
    digest = hashlib.sha256(json.dumps(content, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    previous = db.query(func.max(BomVersion.version_no)).filter_by(product_id=product.id).scalar() or 0
    version = BomVersion(product_id=product.id, tenant_id=product.company_id, version_no=previous+1,
                         created_by=user.id, digest=digest, content=content)
    db.add(version)
    db.flush()
    study = ProductStudy(bom_version_id=version.id, tenant_id=product.company_id, **payload.model_dump(exclude={"allocations"}))
    db.add(study)
    db.flush()
    from ..services.product_inventory import capture
    capture(db, study, version)
    db.add_all(allocation_row(db, product.company_id, study, item) for item in payload.allocations)
    db.commit()
    return study_info(study, version)


@router.post("/{product_id}/{study_id}/calculate")
def run_study(product_id: str, study_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    product = product_for(db, user, product_id, write=True)
    pair = db.query(ProductStudy, BomVersion).join(BomVersion, BomVersion.id==ProductStudy.bom_version_id).filter(
        ProductStudy.id==study_id, BomVersion.product_id==product.id, ProductStudy.tenant_id==product.company_id
    ).first()
    if not pair:
        raise HTTPException(404, "产品研究版本不存在")
    study, version = pair
    allocation = db.query(PcfAllocation).filter_by(study_id=study.id).order_by(PcfAllocation.id).all()
    snapshot = {"study":study_info(study,version), "allocations":[{
        "record_no": line.record_no, "run_id": line.inventory_run_id, "share_ratio": float(line.share_ratio),
        "emissions_kgco2e":float(line.emissions_kgco2e), "reason":line.reason, "activity":line.item_snapshot
    } for line in allocation]}
    return run_product(db, product_id=product_id, company_id=product.company_id,
                       product=version.content["product"], bom_items=version.content["bom_items"],
                       frozen_factors=version.content["factors"], study_snapshot=snapshot)


@router.get("/{product_id}/{study_id}/inventory")
def inventory_lines(product_id:str,study_id:int,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    from ..models.enterprise_domains import BomLine,PcfInventoryItem
    row=db.query(ProductStudy,BomVersion,Product).join(BomVersion,BomVersion.id==ProductStudy.bom_version_id).join(
        Product,Product.id==BomVersion.product_id).filter(ProductStudy.id==study_id,Product.product_id==product_id).first()
    if not row:
        raise HTTPException(404,"研究版本不存在")
    check_company_access(db,user,row[2].company_id)
    lines=db.query(PcfInventoryItem,BomLine).join(BomLine,BomLine.id==PcfInventoryItem.bom_line_id).filter(
        PcfInventoryItem.study_id==study_id,PcfInventoryItem.tenant_id==row[2].company_id).order_by(BomLine.id)
    return [{"code":b.item_code.removeprefix("item:"),"name":b.material_name,"parent":b.parent_line_id,"stage":i.stage_code,
             "basis":i.data_origin,"net_amount":i.net_amount,"currency":i.currency,"factor_version_id":i.factor_version_id} for i,b in lines]
