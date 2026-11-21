"""产品碳足迹（PCF）路由：产品、BOM 导入、SBERT 因子匹配、核算与报告。"""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import check_company_access, get_current_user, tenant_company_id
from ..models import BomAssembly, BOMItem, EmissionFactor, Product, User
from ..services import factor_rows
from ..crypto import read_secret
from ..schemas import BOMImport, BOMItemCreate, ProductCreate
from ..services.tabular import TABULAR_ERRORS, iter_table, table_error, table_values
from ..services.calculation_service import _load_product_payload, run_product
from ..services.report_service import generate_pcf
from ..services.sbert_matcher import match_material
from ..services import SCOPE_BY_CATEGORY

router = APIRouter(prefix="/products", tags=["产品碳足迹"])


class BomFactorSelection(BaseModel):
    factor_id: str = Field(min_length=1, max_length=64)


@router.put("/{product_id}/bom/{bom_item_id}/factor")
def set_bom_factor(product_id: str, bom_item_id: str, payload: BomFactorSelection,
                   db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    product = _get_product_or_404(db, product_id, user, write=True)
    # 与自动匹配按产品串行，避免模型请求返回时覆盖已保存的人工选择。
    db.query(Product).filter(Product.id == product.id).with_for_update().one()
    item = db.query(BOMItem).filter_by(product_id=product.id, bom_item_id=bom_item_id).first()
    if item is None:
        raise HTTPException(status_code=404, detail="未找到该产品的物料")
    row = factor_rows(db, product.company_id).filter(EmissionFactor.factor_id==payload.factor_id).first()
    factor = row[0] if row else None
    if (factor is None or SCOPE_BY_CATEGORY.get(factor.category) != "scope3"
            or factor.scope != "scope3" or factor.unit not in ("kgCO2e/CNY", "kgCO2/CNY")):
        raise HTTPException(status_code=422, detail="请选择适用于采购金额法的范围 3 因子")
    item.matched_category = factor.category
    item.matched_factor_id = factor.factor_id
    item.match_confidence = None
    db.commit()
    return _bom_dict(item)



def _bom_dict(item: BOMItem) -> dict:
    return {
        "bom_item_id": item.bom_item_id, "material_name": item.material_name,
        "material_amount": item.material_amount, "currency": item.currency,
        "matched_category": item.matched_category, "matched_factor_id": item.matched_factor_id,
        "match_confidence": item.match_confidence,
        "assembly_path": item.assembly.assembly_path if item.assembly else None,
    }


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
        "bom_items": [_bom_dict(b) for b in bom],
    }


@router.post("/{product_id}/bom", status_code=201)
def import_bom(product_id: str, payload: BOMImport, db: Session = Depends(get_db),
               user: User = Depends(get_current_user)):
    p = _get_product_or_404(db, product_id, user, write=True)
    return _import_materials(db, p, payload.bom_items)


def _import_materials(db, product, materials, *, preview=False):
    db.query(Product.id).filter_by(id=product.id).with_for_update().one()
    existing = {row.bom_item_id: row for row in db.query(BOMItem).filter_by(product_id=product.id)}
    seen, pending, skipped = set(), [], 0
    for item in materials:
        if item.bom_item_id in seen:
            raise HTTPException(status_code=422, detail=f"物料编号 {item.bom_item_id} 在本批重复")
        seen.add(item.bom_item_id)
        if item.currency != "CNY":
            raise HTTPException(status_code=422, detail="物料金额须统一换算为人民币")
        old = existing.get(item.bom_item_id)
        if old is not None:
            if any(_bom_dict(old)[field] != getattr(item, field)
                   for field in ("material_name", "material_amount", "currency", "assembly_path")):
                raise HTTPException(status_code=409, detail=f"物料 {item.bom_item_id} 已存在且内容不同")
            skipped += 1
            continue
        row = BOMItem(product_id=product.id, **item.model_dump(exclude={"assembly_path"}))
        if item.assembly_path:
            row.assembly = BomAssembly(assembly_path=item.assembly_path)
        pending.append(row)
    if not seen:
        raise HTTPException(status_code=422, detail="表格没有物料")
    if not preview:
        db.add_all(pending)
        db.commit()
    return {"product_id": product.product_id, "imported": 0 if preview else len(pending),
            "ready": len(pending), "skipped": skipped, "total_rows": len(seen)}


def _read_bom(name, content):
    required = {"bom_item_id", "material_name", "material_amount"}
    rows = []
    for line, raw in enumerate(iter_table(name, content, required), 2):
        if line > 10001:
            raise ValueError("单次最多导入 10000 行")
        try:
            row = table_values(raw)
            if any(row.values()):
                rows.append(BOMItemCreate(
                    bom_item_id=row.get("bom_item_id", ""), material_name=row.get("material_name", ""),
                    material_amount=row.get("material_amount", ""), currency=row.get("currency") or "CNY",
                    assembly_path=row.get("assembly_path") or None,
                ))
        except ValueError as exc:
            raise ValueError(f"第 {line} 行：{table_error(exc)}") from exc
    return rows


@router.post("/{product_id}/bom/import", status_code=201)
async def import_bom_file(product_id: str, preview: bool = False, file: UploadFile = File(...),
                          db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    p = _get_product_or_404(db, product_id, user, write=True)
    limit = 5 * 1024 * 1024
    content = await file.read(limit + 1)
    if len(content) > limit:
        raise HTTPException(status_code=413, detail="BOM 文件不可超过 5 MB")
    try:
        materials = await run_in_threadpool(_read_bom, file.filename or "", content)
    except TABULAR_ERRORS as exc:
        raise HTTPException(status_code=422, detail=table_error(exc)) from exc
    return await run_in_threadpool(lambda: _import_materials(db, p, materials, preview=preview))


@router.post("/{product_id}/match")
def match_bom(product_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """SBERT 语义对齐：将 BOM 物料名映射到部门类别与排放因子。"""
    p = _get_product_or_404(db, product_id, user, write=True)
    bom = db.query(BOMItem).filter(BOMItem.product_id == p.id).all()
    results = []
    suggestions = {row.bom_item_id: match_material(row.material_name) for row in bom
                   if not (row.matched_factor_id and row.match_confidence is None)}
    db.query(Product).filter(Product.id == p.id).with_for_update().one()
    db.expire_all()
    for b in bom:
        if b.matched_factor_id and b.match_confidence is None:
            continue
        m = suggestions.get(b.bom_item_id)
        if m is None:
            continue
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
def pcf_report(product_id: str, language: Literal["zh", "en", "de", "fr"] = "zh", run_id: str | None = None,
               db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    product = _get_product_or_404(db, product_id, user, write=True)
    from ..models import CalculationRun

    runs = db.query(CalculationRun).filter_by(company_id=product.company_id, product_id=product_id,
                                               operation="product", status="success")
    selected = runs.filter_by(run_id=run_id).first() if run_id else runs.order_by(CalculationRun.id.desc()).first()
    if selected is None:
        if run_id:
            raise HTTPException(status_code=404, detail="未找到该产品的成功核算")
        return {"product_id": product_id, "found": False}

    captured = read_secret(selected.request_snapshot) or {}
    if not (run_id and captured.get("product_study")):
        current_product, current_bom = _load_product_payload(db, product_id)
        previous = captured.get("payload", {})
        order = lambda rows: sorted(rows, key=lambda item: item["bom_item_id"])
        if previous.get("product") != current_product or order(previous.get("bom_items", [])) != order(current_bom):
            raise HTTPException(status_code=409, detail="物料或因子已变化，请重新核算后生成报告")
    return generate_pcf(db, product_id=product_id, run_id=selected.run_id, language=language)
