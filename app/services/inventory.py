"""盘查期间共用的台账写入保护和冻结输入校验。"""
import hashlib
import json

from fastapi import HTTPException
from sqlalchemy.orm import joinedload

from ..models import BusinessRecord, Company
from ..models.inventory import InventoryAssignment, InventoryPeriod
from . import records_to_algo


def lock_company(db, company_id):
    # 同一企业的关账和台账写入使用相同的事务锁。
    row = db.query(Company.id).filter_by(id=company_id).with_for_update().first()
    if row is None:
        raise HTTPException(status_code=404, detail="企业不存在")


def ledger_write_restrictions(db, company_id, user_id):
    duty = db.get(InventoryAssignment, (company_id, user_id))
    is_reviewer = duty is not None and duty.duty == "reviewer"
    rows = db.query(InventoryPeriod.period, InventoryPeriod.status).filter_by(company_id=company_id)
    return {
        month: (409, f"{month} 已送审或关账，请在月度盘查处理后再修改台账") if status != "open"
        else (403, f"月度盘查复核人不能修改 {month} 的台账")
        for month, status in rows if status != "open" or is_reviewer
    }


def require_open_period(db, company_id, period, user_id):
    restriction = ledger_write_restrictions(db, company_id, user_id).get(period)
    if restriction:
        raise HTTPException(status_code=restriction[0], detail=restriction[1])


def ledger_digest(records):
    data = sorted(records, key=lambda record: record["id"])
    return hashlib.sha256(json.dumps(data, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()


def current_ledger_digest(db, company_id, period):
    rows = db.query(BusinessRecord).options(joinedload(BusinessRecord.dimensions)).filter_by(
        company_id=company_id, period=period, review_status="confirmed"
    ).all()
    return ledger_digest(records_to_algo(rows))
