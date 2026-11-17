"""产品碳足迹（PCF）路由：产品、BOM 导入、SBERT 因子匹配、核算与报告。"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import check_company_access, get_current_user, tenant_company_id
from ..models import BOMItem, Product, User
from ..schemas import BOMImport, ProductCreate
from ..services.calculation_service import run_product
from ..services.report_service import generate_pcf
from ..services.sbert_matcher import match_material

router = APIRouter(prefix="/products", tags=["产品碳足迹"])


def _product_dict(p: Product) -> dict:
    return {
        "id": p.id, "product_id": p.product_id, "product_name": p.product_name,
        "company_id": p.company_id, "output_quantity": p.output_quantity,
        "product_unit": p.product_unit, "description": p.description,
    }


def _get_product_or_404(db, product_id: str, user: User, write: bool = False) -> Product:
    p = db.query(Product).filter(Product.product_id == product_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="产品不存在")
    check_company_access(db, user, p.company_id, write=write)
    return p


@router.post("", status_code=201)
def create_product(payload: ProductCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    check_company_access(db, user, payload.company_id, write=True)
    if db.query(Product).filter(Product.product_id == payload.product_id).first():
        raise HTTPException(status_code=400, detail="产品编号已存在")
    p = Product(**payload.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return _product_dict(p)


@router.get("")
def list_products(company_id: int | None = None, db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    cid = tenant_company_id(user, company_id)
    q = db.query(Product).order_by(Product.id)
    if cid:
        q = q.filter(Product.company_id == cid)
    return [_product_dict(p) for p in q.all()]


@router.get("/{product_id}")
def get_product(product_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    p = _get_product_or_404(db, product_id, user)
    bom = db.query(BOMItem).filter(BOMItem.product_id == p.id).all()
    return {
        **_product_dict(p),
        "bom_items": [
            {
                "bom_item_id": b.bom_item_id, "material_name": b.material_name,
                "material_amount": b.material_amount, "currency": b.currency,
                "matched_category": b.matched_category, "matched_factor_id": b.matched_factor_id,
                "match_confidence": b.match_confidence,
            }
            for b in bom
        ],
    }


@router.post("/{product_id}/bom", status_code=201)
def import_bom(product_id: str, payload: BOMImport, db: Session = Depends(get_db),
               user: User = Depends(get_current_user)):
    p = _get_product_or_404(db, product_id, user, write=True)
    created = 0
    for item in payload.bom_items:
        if db.query(BOMItem).filter(BOMItem.product_id == p.id,
                                    BOMItem.bom_item_id == item.bom_item_id).first():
            continue
        db.add(BOMItem(product_id=p.id, **item.model_dump()))
        created += 1
    db.commit()
    return {"product_id": product_id, "imported": created}


@router.post("/{product_id}/match")
def match_bom(product_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """SBERT 语义对齐：将 BOM 物料名映射到部门类别与排放因子。"""
    p = _get_product_or_404(db, product_id, user, write=True)
    bom = db.query(BOMItem).filter(BOMItem.product_id == p.id).all()
    results = []
    for b in bom:
        m = match_material(b.material_name)
        b.matched_category = m["matched_category"]
        b.matched_factor_id = m["matched_factor_id"]
        b.match_confidence = m["confidence"]
        results.append(m)
    db.commit()
    return {"product_id": product_id, "matched_items": results}


@router.post("/{product_id}/calculate")
def calculate_pcf(product_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    p = _get_product_or_404(db, product_id, user, write=True)
    return run_product(db, product_id=product_id, company_id=p.company_id)


@router.get("/{product_id}/report")
def pcf_report(product_id: str, language: str = "zh", db: Session = Depends(get_db),
               user: User = Depends(get_current_user)):
    _get_product_or_404(db, product_id, user)
    return generate_pcf(db, product_id=product_id, language=language)
