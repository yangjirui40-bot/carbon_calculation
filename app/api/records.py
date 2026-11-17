"""业务记录路由：单条录入、批量导入、查询与删除。"""
from __future__ import annotations

import csv
import io

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import check_company_access, get_current_user, tenant_company_id
from ..models import BusinessRecord, User
from ..schemas import RecordCreate

router = APIRouter(prefix="/records", tags=["业务记录"])


def _to_dict(r: BusinessRecord) -> dict:
    return {
        "id": r.id, "record_no": r.record_no, "company_id": r.company_id, "period": r.period,
        "category": r.category, "scope": r.scope, "quantity": r.quantity, "unit": r.unit,
        "amount": r.amount, "currency": r.currency, "factor_id": r.factor_id,
        "review_status": r.review_status, "source": r.source, "document_id": r.document_id,
        "remark": r.remark,
    }


@router.post("", status_code=201)
def create_record(payload: RecordCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    check_company_access(db, user, payload.company_id, write=True)
    if db.query(BusinessRecord).filter(BusinessRecord.record_no == payload.record_no).first():
        raise HTTPException(status_code=400, detail="记录编号已存在")
    r = BusinessRecord(**payload.model_dump())
    db.add(r)
    db.commit()
    db.refresh(r)
    return _to_dict(r)


@router.get("")
def list_records(company_id: int | None = None, period: str | None = None,
                 db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cid = tenant_company_id(user, company_id)
    q = db.query(BusinessRecord)
    if cid:
        q = q.filter(BusinessRecord.company_id == cid)
    if period:
        q = q.filter(BusinessRecord.period == period)
    return [_to_dict(r) for r in q.order_by(BusinessRecord.id).all()]


@router.post("/import", status_code=201)
async def import_records(company_id: int, file: UploadFile = File(...),
                         db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """批量导入业务记录（CSV 或 XLSX）。列：record_no,period,category,scope,quantity,unit,amount,currency,factor_id,review_status"""
    check_company_access(db, user, company_id, write=True)
    name = (file.filename or "").lower()
    content = await file.read()
    rows: list[dict] = []
    if name.endswith(".csv"):
        reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig")))
        rows = list(reader)
    elif name.endswith(".xlsx"):
        try:
            from openpyxl import load_workbook
            wb = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
            ws = wb.active
            headers = [c.value for c in next(ws.iter_rows(min_row=1, max_row=1))]
            for row in ws.iter_rows(min_row=2, values_only=True):
                rows.append({str(h): v for h, v in zip(headers, row) if h is not None})
        except ImportError:
            raise HTTPException(status_code=400, detail="未安装 openpyxl，无法解析 XLSX")
    else:
        raise HTTPException(status_code=400, detail="仅支持 CSV 或 XLSX")

    created = 0
    for row in rows:
        record_no = (row.get("record_no") or "").strip()
        if not record_no:
            continue
        if db.query(BusinessRecord).filter(BusinessRecord.record_no == record_no).first():
            continue
        rec = BusinessRecord(
            record_no=record_no,
            company_id=company_id,
            period=(row.get("period") or "").strip(),
            category=(row.get("category") or "").strip(),
            scope=(row.get("scope") or "").strip(),
            quantity=float(row["quantity"]) if row.get("quantity") not in (None, "") else None,
            unit=(row.get("unit") or "").strip() or None,
            amount=float(row["amount"]) if row.get("amount") not in (None, "") else None,
            currency=(row.get("currency") or "CNY").strip(),
            factor_id=(row.get("factor_id") or "").strip(),
            review_status=(row.get("review_status") or "confirmed").strip(),
            source="excel",
        )
        db.add(rec)
        created += 1
    db.commit()
    return {"imported": created, "total_rows": len(rows)}


@router.delete("/{record_no}", status_code=204)
def delete_record(record_no: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    r = db.query(BusinessRecord).filter(BusinessRecord.record_no == record_no).first()
    if not r:
        raise HTTPException(status_code=404, detail="记录不存在")
    check_company_access(db, user, r.company_id, write=True)
    db.delete(r)
    db.commit()
