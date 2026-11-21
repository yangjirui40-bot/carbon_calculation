"""业务记录路由：单条录入、批量导入、查询与删除。"""
from __future__ import annotations

from typing import Literal

from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy.exc import IntegrityError
from ..models.organization import ActivityRevision, OrgUnit, Site
from algorithm_pkg.models.core import CalculationError, calculate_record

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import check_company_access, get_current_user, tenant_company_id
from ..models import BusinessRecord, Company, RecordDimensions, User
from ..schemas import RecordClassification, RecordCreate
from ..services import load_factors_from_db
from ..services.inventory import ledger_write_restrictions, lock_company, require_open_period
from ..services.activity import activity_fields, apply_org_names, create_activity_revision, track_activity_change
from ..services.organization import period_site_catalog, require_period_location, set_activity_location, validate_location
from ..services.tabular import TABULAR_ERRORS, iter_table, table_error, table_values

router = APIRouter(prefix="/records", tags=["业务记录"])


def _to_dict(r: BusinessRecord) -> dict:
    return {
        "id": r.id, "record_no": r.record_no, "company_id": r.company_id, "period": r.period,
        "category": r.category, "scope": r.scope, "quantity": r.quantity, "unit": r.unit,
        "amount": r.amount, "currency": r.currency, "factor_id": r.factor_id,
        "review_status": r.review_status, "source": r.source, "document_id": r.document_id,
        "remark": r.remark,
        **activity_fields(r),
        "site_id": r.location.site_id if r.location else None,
        "org_unit_id": r.location.org_unit_id if r.location else None,
        **{field: getattr(r.dimensions, field, None) for field in RecordClassification.model_fields},
    }


@router.post("", status_code=201)
def create_record(payload: RecordCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return write_record(payload, db, user)


def write_record(payload, db, user, *, reading=None):
    check_company_access(db, user, payload.company_id, write=True)
    lock_company(db, payload.company_id)
    require_open_period(db, payload.company_id, payload.period, user.id)
    if payload.document_id is not None:
        from ..models import SourceDocument
        doc = db.get(SourceDocument, payload.document_id)
        if doc is not None and doc.doc_type=="revenue_evidence":
            raise HTTPException(422,"收入证明须在融资底稿中引用")
        if doc is None or doc.company_id != payload.company_id:
            raise HTTPException(status_code=422, detail="业务记录与原始单据必须属于同一企业")
    if db.query(BusinessRecord).filter(BusinessRecord.record_no == payload.record_no).first():
        raise HTTPException(status_code=400, detail="记录编号已存在")
    require_period_location(db, payload.company_id, payload.period, payload.site_id)
    site, unit = validate_location(db, payload.company_id, payload.site_id, payload.org_unit_id)
    try:
        calculate_record({**payload.model_dump(), "id": payload.record_no, "review_status": "confirmed"}, load_factors_from_db(db, company_id=payload.company_id))
    except CalculationError as exc:
        raise HTTPException(422, str(exc)) from exc
    r = _record(payload)
    set_activity_location(r, site, unit)
    apply_org_names(db, r, unit)
    if site:
        r.revisions = [create_activity_revision(r, user.id, "新增台账", version=1)]
    if reading:
        r.revisions[0].snapshot.update(reading)
    db.add(r)
    db.commit()
    db.refresh(r)
    _refresh_olap_safe(db, r.company_id)
    return _to_dict(r)


def _refresh_olap_safe(db, company_id) -> None:
    try:
        from ..services.olap import refresh_olap
        refresh_olap(db, company_id)
    except Exception:  # noqa: BLE001
        db.rollback()


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


@router.get("/page")
def page_records(company_id: int | None = None, period: str | None = None, category: str | None = None,
                 scope: str | None = None, review_status: str | None = None, site_id: int | None = None,
                 page: int = Query(1, ge=1, le=1_000_000), size: int = Query(50, ge=1, le=250),
                 db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cid = tenant_company_id(user, company_id)
    q = db.query(BusinessRecord)
    if cid:
        q = q.filter_by(company_id=cid)
    periods = [value for value, in q.with_entities(BusinessRecord.period).distinct().order_by(BusinessRecord.period.desc()).limit(240)]
    for field, value in (("period", period), ("category", category), ("scope", scope), ("review_status", review_status)):
        if value is not None:
            q = q.filter(getattr(BusinessRecord, field) == value)
    if site_id is not None:
        from ..models.organization import ActivityLocation
        q = q.join(ActivityLocation, ActivityLocation.record_id == BusinessRecord.id).filter(ActivityLocation.site_id == site_id)
    total = q.count()
    page = min(page, max(1, (total + size - 1) // size))
    rows = q.order_by(BusinessRecord.id.desc()).offset((page - 1) * size).limit(size)
    return {"records": [_to_dict(row) for row in rows], "periods": periods, "total": total, "page": page}


IMPORT_LIMIT = 20 * 1024 * 1024
ROW_LIMIT = 100_000
REQUIRED_COLUMNS = {"record_no", "period", "category", "scope", "factor_id"}
DIMENSIONS = set(RecordClassification.model_fields)
LOCATION = {"site_id", "org_unit_id"}
IMPORT_ERRORS = (CalculationError,) + TABULAR_ERRORS


def _record(payload: RecordCreate):
    dimensions = payload.model_dump(include=DIMENSIONS, exclude_none=True)
    row = BusinessRecord(**payload.model_dump(exclude=DIMENSIONS | LOCATION))
    if dimensions:
        row.dimensions = RecordDimensions(**dimensions)
    return row


def _record_for_write(db, user, record_no):
    query = db.query(BusinessRecord).filter_by(record_no=record_no)
    row = query.first()
    if row is None:
        raise HTTPException(status_code=404, detail="记录不存在")
    check_company_access(db, user, row.company_id, write=True)
    lock_company(db, row.company_id)
    row = query.populate_existing().first()
    if row is None:
        raise HTTPException(status_code=404, detail="记录不存在")
    check_company_access(db, user, row.company_id, write=True)
    require_open_period(db, row.company_id, row.period, user.id)
    from ..models.enterprise_controls import CertificateAllocation
    if db.query(CertificateAllocation.id).filter_by(record_id=row.id, cancelled_at=None).first():
        raise HTTPException(409, "台账有生效的绿电分配，请先撤销再修订")
    return row


class ClassificationChange(RecordClassification):
    site_id: int | None = None
    org_unit_id: int | None = None


@router.put("/{record_no}/classification")
def classify_record(record_no: str, payload: ClassificationChange,
                    db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = _record_for_write(db, user, record_no)
    if payload.scope3_category is not None and row.scope != "scope3":
        raise HTTPException(status_code=422, detail="仅范围 3 记录可归入价值链分类")
    if row.review_status == "rejected":
        raise HTTPException(409,"已冲销记录不再编辑")
    if row.dimensions is None:
        row.dimensions = RecordDimensions()
    for field, value in payload.model_dump(exclude=LOCATION).items():
        setattr(row.dimensions, field, value)
    if payload.model_fields_set & LOCATION:
        site_id = payload.site_id if "site_id" in payload.model_fields_set else getattr(row.location, "site_id", None)
        unit_id = payload.org_unit_id if "org_unit_id" in payload.model_fields_set else getattr(row.location, "org_unit_id", None)
    else:
        site_id, unit_id = getattr(row.location, "site_id", None), getattr(row.location, "org_unit_id", None)
    require_period_location(db, row.company_id, row.period, site_id)
    site, unit = validate_location(db, row.company_id, site_id, unit_id)
    set_activity_location(row, site, unit)
    apply_org_names(db, row, unit)
    track_activity_change(db, row, user.id, "调整组织归集")
    db.commit()
    _refresh_olap_safe(db, row.company_id)
    return _to_dict(row)


def _validated_rows(name, content, company_id, catalog_codes):
    for line, raw in enumerate(iter_table(name, content, REQUIRED_COLUMNS, expanded_mib=128), 2):
        if line > ROW_LIMIT + 1:
            raise ValueError(f"单次最多导入 {ROW_LIMIT} 行")
        try:
            row = table_values(raw)
            if not any(row.values()):
                continue
            site_code = (row.get("site_code") or "").strip().upper()
            unit_code = (row.get("org_unit_code") or "").strip().upper()
            site_id = catalog_codes[0].get(site_code)
            org_unit_id = catalog_codes[1].get((site_id, unit_code))
            if (site_code and not site_id) or (unit_code and not org_unit_id):
                raise ValueError("工厂编码、组织单元编码不属于本企业")
            yield RecordCreate(site_id=site_id, org_unit_id=org_unit_id,
                record_no=row.get("record_no", ""), company_id=company_id, period=row.get("period", ""),
                category=row.get("category", ""), scope=row.get("scope", ""),
                quantity=row.get("quantity") or None, unit=row.get("unit") or None,
                amount=row.get("amount") or None, currency=row.get("currency") or "CNY",
                factor_id=row.get("factor_id", ""), review_status=row.get("review_status") or "confirmed",
                source="excel", workshop=row.get("workshop") or None,
                production_line=row.get("production_line") or None, scope3_category=row.get("scope3_category") or None,
            )
        except (ValueError, ValidationError) as exc:
            raise ValueError(f"第 {line} 行：{table_error(exc)}") from exc


def _write_batch(db, company_id, user_id, records, preview=False, compare=False, *, defer_commit=False):
    import re

    factors = load_factors_from_db(db, company_id=company_id)
    lock_company(db, company_id)
    restrictions = ledger_write_restrictions(db, company_id, user_id)
    managed = period_site_catalog(db, company_id)
    sites = {s.id: s for s in db.query(Site).filter_by(tenant_id=company_id)}
    units = {u.id: u for u in db.query(OrgUnit).filter_by(tenant_id=company_id)}
    codes = ({s.code: s.id for s in sites.values()}, {(u.site_id, u.code): u.id for u in units.values()})
    records = records(codes)
    seen, batch = set(), []
    imported = skipped = 0

    def flush_rows(rows):
        existing = {record.record_no: record for record in db.query(BusinessRecord).filter(
            BusinessRecord.record_no.in_(r.record_no for r in rows)).all()}
        new = []
        for payload in rows:
            row = existing.get(payload.record_no)
            if row is None:
                new.append(payload)
                continue
            if row.company_id != company_id:
                raise ValueError("记录号不可使用，请增加企业编码前缀")
            if compare and any(_to_dict(row).get(key) != value
                               for key, value in payload.model_dump(exclude={"review_status"}).items()):
                raise ValueError(f"记录号 {row.record_no} 已存在且内容不同")
        if not preview and new:
            for payload in new:
                record = _record(payload)
                site, unit = sites.get(payload.site_id), units.get(payload.org_unit_id)
                set_activity_location(record, site, unit)
                apply_org_names(db, record, unit, units)
                if site:
                    record.revisions = [create_activity_revision(record, user_id, "导入台账", version=1)]
                db.add(record)
            db.flush()
        return len(new), len(existing)

    try:
        for payload in records:
            number = payload.record_no
            if not number or len(number) > 64 or not re.fullmatch(r"[1-9][0-9]{3}-(0[1-9]|1[0-2])", payload.period):
                raise ValueError(f"第 {len(seen) + 1} 条需填写有效记录号及 YYYY-MM 期间")
            if payload.period in restrictions:
                code, message = restrictions[payload.period]
                raise HTTPException(status_code=code, detail=message)
            if payload.period in managed and payload.site_id not in managed[payload.period]:
                raise HTTPException(422, f"第 {len(seen)+1} 条活动未归集到 {payload.period} 边界内工厂")
            _, unit = validate_location(db, company_id, payload.site_id, payload.org_unit_id, catalog=(sites, units))
            if unit:
                parent = units.get(unit.parent_id)
                payload = payload.model_copy(update={"workshop": parent.name if parent else unit.name,
                                                     "production_line": unit.name if unit.kind == "line" else None})
            if payload.review_status not in ("confirmed", "pending"):
                raise ValueError(f"记录 {number} 的复核状态须为 confirmed 或 pending")
            if number in seen:
                raise ValueError(f"记录 {number} 在本批重复")
            calculate_record({**payload.model_dump(), "id": number, "review_status": "confirmed"}, factors)
            seen.add(number)
            batch.append(payload)
            if len(batch) == 1000:
                added, repeated = flush_rows(batch)
                imported += added
                skipped += repeated
                batch.clear()
        if batch:
            added, repeated = flush_rows(batch)
            imported += added
            skipped += repeated
        if not seen:
            raise ValueError("表格没有可导入的数据")
        if preview:
            db.rollback()
        elif not defer_commit:
            db.commit()
    except HTTPException:
        db.rollback()
        raise
    except IMPORT_ERRORS as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail=table_error(exc)) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="有记录同时写入，请核对后重试") from exc
    return {"imported": 0 if preview else imported, "ready": imported, "total_rows": len(seen), "skipped": skipped}


@router.post("/import", status_code=201)
async def import_records(company_id: int, preview: bool = False, file: UploadFile = File(...),
                         db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    check_company_access(db, user, company_id, write=True)
    if db.get(Company, company_id) is None:
        raise HTTPException(status_code=404, detail="企业不存在")
    content = await file.read(IMPORT_LIMIT + 1)
    if len(content) > IMPORT_LIMIT:
        raise HTTPException(status_code=413, detail="台账文件不可超过 20 MB")
    return await run_in_threadpool(_write_batch, db, company_id, user.id, lambda codes: _validated_rows(file.filename or "", content, company_id, codes),
                                   preview, False)


class RecordSyncItem(RecordClassification):
    site_id: int | None = None
    org_unit_id: int | None = None
    record_no: str
    period: str
    category: str
    scope: str
    quantity: float | None = None
    unit: str | None = None
    amount: float | None = None
    currency: str = "CNY"
    factor_id: str
    remark: str | None = Field(None, max_length=1024)


class RecordSync(BaseModel):
    company_id: int
    records: list[RecordSyncItem] = Field(min_length=1, max_length=1000)


@router.post("/sync", status_code=201)
def sync_records(payload: RecordSync, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """ERP/财务接口。由授权企业账户提交，进入待核对台账。"""
    check_company_access(db, user, payload.company_id, write=True)
    if db.get(Company, payload.company_id) is None:
        raise HTTPException(status_code=404, detail="企业不存在")
    def records(codes):
        for row in payload.records:
            yield RecordCreate(**row.model_dump(), company_id=payload.company_id, source="api", review_status="pending")
    return _write_batch(db, payload.company_id, user.id, records, compare=True)


@router.post("/{record_no}/confirm")
def confirm_record(record_no: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = _record_for_write(db, user, record_no)
    if row.review_status not in ("pending", "confirmed"):
        raise HTTPException(status_code=409, detail="仅待复核或已确认记录可执行确认")
    if row.source == "photo" or row.document_id is not None:
        raise HTTPException(status_code=422, detail="凭证记录请在凭证复核页确认")
    try:
        calculate_record({**_to_dict(row), "id": row.record_no, "review_status": "confirmed"}, load_factors_from_db(db, company_id=row.company_id))
    except CalculationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    row.review_status = "confirmed"
    track_activity_change(db, row, user.id, "复核确认")
    db.commit()
    _refresh_olap_safe(db, row.company_id)
    return _to_dict(row)


class Adjustment(BaseModel):
    action: Literal["correct", "void"]
    reason: str = Field(min_length=2, max_length=500)
    expected_revision: int = Field(ge=0)
    quantity: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    amount: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    unit: str | None = Field(default=None, max_length=32)
    factor_id: str | None = Field(default=None, max_length=64)


@router.get("/{record_no}/revisions")
def record_revisions(record_no: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.query(BusinessRecord).filter_by(record_no=record_no).first()
    if row is None:
        raise HTTPException(404, "台账记录不存在")
    check_company_access(db, user, row.company_id)
    rows = db.query(ActivityRevision,User.username).join(User,User.id==ActivityRevision.changed_by).filter(
        ActivityRevision.record_id==row.id
    ).order_by(ActivityRevision.revision_no.desc()).limit(100)
    return [{"revision_no":r.revision_no,"actor":actor,"reason":r.reason,"record":r.snapshot,
             "created_at":r.created_at.isoformat()} for r,actor in rows]


@router.patch("/{record_no}/adjust")
def adjust(record_no: str,payload:Adjustment,db:Session = Depends(get_db),user:User=Depends(get_current_user)):
    row = _record_for_write(db,user,record_no)
    revision = db.query(ActivityRevision.revision_no).filter_by(
        record_id=row.id
    ).order_by(ActivityRevision.revision_no.desc()).limit(1).scalar()
    if (revision or 0) != payload.expected_revision:
        raise HTTPException(409,"记录版本已变化，刷新后再更正")
    if not row.location:
        raise HTTPException(409,"先建立该记录的工厂归集，再进行有版本的更正")
    if row.review_status=="rejected":
        raise HTTPException(409,"此记录已冲销。如需重新记录，请另建明确关联的台账")
    if payload.action=="void":
        row.review_status="rejected"
    else:
        patch=payload.model_dump(exclude={"action","reason","expected_revision"},exclude_unset=True)
        if not patch:
            raise HTTPException(422,"至少填写一项更正值")
        try:
            calculate_record({**_to_dict(row),**patch,"id":row.record_no,"review_status":"confirmed"},
                             load_factors_from_db(db,company_id=row.company_id))
        except CalculationError as exc:
            raise HTTPException(422,str(exc)) from exc
        for key,value in patch.items():
            setattr(row,key,value)
        # An approved correction retains the original document and is distinguishable by history.
        row.review_status="pending" if row.document_id is None else "confirmed"
    reason=payload.reason.strip()
    if len(reason)<2:
        raise HTTPException(422,"请写明更正或冲销原因")
    track_activity_change(db,row,user.id,("冲销：" if payload.action=="void" else "更正：")+reason)
    db.commit()
    _refresh_olap_safe(db, row.company_id)
    return _to_dict(row)


@router.delete("/{record_no}", status_code=204)
def delete_record(record_no: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    r = _record_for_write(db, user, record_no)
    if db.query(ActivityRevision.id).filter_by(record_id=r.id).first():
        raise HTTPException(409, "已建立版本的企业台账应通过更正保留历史")
    db.delete(r)
    db.commit()
    _refresh_olap_safe(db, r.company_id)
