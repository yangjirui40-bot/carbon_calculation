"""智能数据解析厂：原始单据上传（对象存储）、真实 OCR+LayoutLMv3 异步解析、
POMDP-LLM 纠偏、复核入库、AI 引擎状态。"""
from __future__ import annotations

import hashlib
import time
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, Response
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models.enterprise_controls import RawObject, DocumentPage, ExtractedField
from ..crypto import read_secret, store_secret
from ..database import get_db
from ..deps import check_company_access, get_current_user
from ..jobs import register_handler, submit_job
from ..models import BusinessRecord, Job, SourceDocument, User, utcnow
from ..models.operational_history import DocumentParseRun, DocumentReview, InvoiceVerification
from ..services.billing_service import enforce_quota
from ..storage import get_storage

router = APIRouter(prefix="/documents", tags=["智能数据解析"])


class ReviewRequest(BaseModel):
    site_id: int | None = None
    org_unit_id: int | None = None
    period: str | None = None
    category: str | None = None
    scope: str | None = None
    factor_id: str | None = None
    quantity: float | None = None
    unit: str | None = None
    amount: float | None = None
    currency: str = "CNY"
    review_status: str = "confirmed"
    fields_override: dict | None = None  # 人工复核修正字段（覆盖 OCR 结果）
    note: str | None = None


def _to_dict(d: SourceDocument) -> dict:
    return {
        "id": d.id, "company_id": d.company_id, "doc_type": d.doc_type, "file_name": d.file_name,
        "file_ext": d.file_ext, "parse_status": d.parse_status,
        "extracted_fields": read_secret(d.extracted_fields),
        "overall_confidence": d.overall_confidence,
        "ocr_engine": d.ocr_engine, "correction_log": d.correction_log,
        "review_status": d.review_status, "verified_status": d.verified_status,
        "reviewed_by_user_id": d.reviewed_by_user_id, "review_note": d.review_note,
        "created_at": d.created_at.isoformat() if d.created_at else None,
    }


def _job_parse_document(payload: dict) -> dict:
    """异步任务：读取对象存储中的原图 → 真实 OCR + LayoutLMv3 → POMDP-LLM 纠偏。"""
    from ..database import SessionLocal
    from ..services.document_parser import parse_document

    db = SessionLocal()
    attempt_id = None
    try:
        doc = db.get(SourceDocument, int(payload["document_id"]))
        if doc is None:
            return {"ok": False, "error": "document not found"}
        doc.parse_status = "parsing"
        attempt = DocumentParseRun(document_id=doc.id, job_id=payload.get("job_id"),
                                   attempt=payload.get("attempt", 1), state="running")
        db.add(attempt)
        db.flush()
        attempt_id = attempt.id
        db.commit()

        image_bytes = get_storage().load(doc.file_path)
        import time

        from ..metrics import PARSE_DURATION

        t0 = time.perf_counter()
        result = parse_document(image_bytes, doc.doc_type)
        PARSE_DURATION.observe(time.perf_counter() - t0)

        doc.extracted_fields = store_secret(
            {
                "fields": result["extracted_fields"],
                "record_hint": result["record_hint"],
                "fingerprint": result.get("fingerprint"),
                "words": result.get("words", []),
                "raw_fields": result.get("raw_fields", {}),
                "confidence": result.get("confidence", {}),
                "extraction_methods": result.get("extraction_methods", {}),
            }
        )
        doc.correction_log = result["correction_log"] + [
            {"engine": "llm", "review": step} for step in result.get("llm_review", [])
        ]
        confs = [v for v in result["confidence"].values() if isinstance(v, (int, float))]
        doc.overall_confidence = round(sum(confs) / len(confs), 4) if confs else None
        engines = [e for e in (result["ocr_engine"], result.get("ser_engine"), result.get("layout_engine")) if e]
        doc.ocr_engine = " + ".join(engines)
        doc.parse_status = "parsed"
        attempt.state = "parsed"
        for key, value in result["extracted_fields"].items():
            db.add(ExtractedField(parse_id=attempt.id, company_id=doc.company_id, field_name=key,
                   protected_values=store_secret({"raw": result.get("raw_fields", {}).get(key), "accepted": value}),
                   method=result.get("extraction_methods", {}).get(key), confidence=result["confidence"].get(key)))
        attempt.engine = doc.ocr_engine
        attempt.completed_at = utcnow()
        db.commit()
        return {"ok": True, "corrections": result["corrections_count"],
                "engine": doc.ocr_engine}
    except Exception:
        db.rollback()
        failed = db.get(SourceDocument, int(payload["document_id"]))
        if failed is not None:
            failed.parse_status = "failed"
        if attempt_id:
            attempt = db.get(DocumentParseRun, attempt_id)
            if attempt:
                attempt.state = "failed"
                attempt.completed_at = utcnow()
        db.commit()
        raise
    finally:
        db.close()


register_handler("document_parse", _job_parse_document)


def can_read_finance(db,user,cid):
    from ..services.organization import is_company_admin
    return user.role == "auditor" or is_company_admin(db,user,cid)


def check_document_access(db,user,doc,write=False):
    check_company_access(db,user,doc.company_id,write=write)
    if doc.doc_type=="revenue_evidence" and not can_read_finance(db,user,doc.company_id):
        raise HTTPException(403,"营业收入证明仅对企业管理员和审计人员可见")


@router.post("/upload", status_code=201)
async def upload_document(
    company_id: int,
    doc_type: str = "invoice",
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    check_company_access(db, user, company_id, write=True)
    if doc_type=="revenue_evidence" and not can_read_finance(db,user,company_id):
        raise HTTPException(403,"请由企业管理员上传营业收入证明")
    content = await file.read(20 * 1024 * 1024 + 1)
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="单个文件不可超过20MiB")
    if not content:
        raise HTTPException(status_code=422, detail="文件为空")
    if doc_type not in ("invoice", "electricity_bill", "energy_certificate", "revenue_evidence"):
        raise HTTPException(status_code=422, detail="请选择发票、电费单、绿电凭证或收入证明")
    try:
        from ..services.document_media import render_preview
        preview, sizes = render_preview(content)
    except Exception:
        raise HTTPException(status_code=422, detail="无法读取文件；请上传有效图像或1—10页、20MiB内的PDF")
    enforce_quota(db, company_id, "document")
    content_hash = hashlib.sha256(content).hexdigest()
    # 唯一性拦截：同内容单据直接复用已有档案
    duplicate = db.query(SourceDocument).filter(
        SourceDocument.company_id == company_id, SourceDocument.content_hash == content_hash).first()
    ext = (file.filename or "").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "bin"
    key = f"companies/{company_id}/documents/{uuid.uuid4().hex}.{ext}"
    get_storage().save(key, content)
    get_storage().save(key + ".preview.png", preview)
    doc = SourceDocument(
        company_id=company_id, doc_type=doc_type, file_name=file.filename,
        file_path=key, file_ext=ext, parse_status="uploaded", content_hash=content_hash,
    )
    db.add(doc)
    db.flush()
    db.add(RawObject(document_id=doc.id, sha256=content_hash, size_bytes=len(content)))
    db.add_all(DocumentPage(document_id=doc.id, page_number=i, width_px=w, height_px=h)
               for i,(w,h) in enumerate(sizes,1))
    db.commit()
    db.refresh(doc)
    return {**_to_dict(doc),
            "duplicate_hint": f"与单据 #{duplicate.id} 内容完全一致，疑似重复上传" if duplicate and (duplicate.doc_type!="revenue_evidence" or can_read_finance(db,user,company_id)) else None}


@router.get("")
def list_documents(company_id: int | None = None, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    from ..deps import tenant_company_id
    cid = tenant_company_id(user, company_id)
    q = db.query(SourceDocument).order_by(SourceDocument.id.desc())
    if cid:
        q = q.filter(SourceDocument.company_id == cid)
    if not can_read_finance(db,user,cid):
        q=q.filter(SourceDocument.doc_type!="revenue_evidence")
    return [_to_dict(d) for d in q.limit(200).all()]


@router.get("/review-queue")
def review_queue(company_id: int | None = None, confidence_threshold: float = 0.95,
                 db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """人工复核队列：低置信度 / 有纠偏 / 验真失败 / 疑似重复的单据优先复核。"""
    from ..deps import tenant_company_id

    cid = tenant_company_id(user, company_id)
    q = db.query(SourceDocument).filter(SourceDocument.parse_status == "parsed",
                                        SourceDocument.review_status != "confirmed")
    if cid:
        q = q.filter(SourceDocument.company_id == cid)
    q=q.filter(SourceDocument.doc_type!="revenue_evidence")
    docs = q.all()
    queue = []
    for d in docs:
        corrections = (d.correction_log or [])
        reasons = []
        if d.overall_confidence is None or d.overall_confidence < confidence_threshold:
            reasons.append(f"置信度低({d.overall_confidence})")
        if corrections:
            reasons.append(f"POMDP 纠偏 {len(corrections)} 处")
        if d.verified_status == "failed":
            reasons.append("验真失败")
        if reasons:
            queue.append({"id": d.id, "file_name": d.file_name, "doc_type": d.doc_type,
                          "overall_confidence": d.overall_confidence,
                          "verified_status": d.verified_status,
                          "corrections": len(corrections), "reasons": reasons})
    queue.sort(key=lambda x: (x["overall_confidence"] or 0))
    return {"queue": queue, "count": len(queue)}


@router.get("/{doc_id}")
def get_document(doc_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    doc = db.get(SourceDocument, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="单据不存在")
    check_document_access(db, user, doc)
    return _to_dict(doc)


@router.get("/{doc_id}/preview")
def document_preview(doc_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    doc = db.get(SourceDocument, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="单据不存在")
    check_document_access(db, user, doc)
    storage = get_storage()
    path = doc.file_path + ".preview.png"
    try:
        if storage.exists(path):
            content = storage.load(path)
        else:
            from ..services.document_media import preview_png
            content = preview_png(storage.load(doc.file_path))
    except Exception:
        raise HTTPException(status_code=422, detail="原始文件无法预览；请重新上传或联系管理员")
    return Response(content=content, media_type="image/png", headers={"Cache-Control": "private, no-store"})


@router.post("/{doc_id}/parse")
def parse_document_async(doc_id: int, wait: bool = False, db: Session = Depends(get_db),
                         user: User = Depends(get_current_user)):
    """提交异步解析任务（真实 OCR + LayoutLMv3 + POMDP-LLM）。wait=true 时阻塞至完成。"""
    doc = db.get(SourceDocument, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="单据不存在")
    check_document_access(db, user, doc, write=True)
    if doc.doc_type in ("energy_certificate","revenue_evidence"):
        raise HTTPException(422, "证明文件请在对应的绿电或融资材料业务中使用")
    if doc.review_status == "confirmed":
        raise HTTPException(status_code=409, detail="已入库单据不能覆盖重解析，请保留原始核算证据")
    job = submit_job("document_parse", {"document_id": doc_id})
    if not wait:
        return {"job_id": job.id, "status": "queued", "document_id": doc_id}

    deadline = time.time() + 300  # 冷启动需加载 OCR/SER/LayoutLMv3 模型，放宽等待
    while time.time() < deadline:
        time.sleep(0.5)
        db.expire_all()
        j = db.get(Job, job.id)
        if j and j.status in ("success", "failed"):
            doc = db.get(SourceDocument, doc_id)
            if j.status == "failed":
                raise HTTPException(status_code=500, detail=f"解析失败：{j.error}")
            return {"job_id": j.id, "status": j.status, **_to_dict(doc)}
    raise HTTPException(status_code=504, detail="解析超时，请稍后通过 GET /documents/{id} 查询")


def _duplicate_check(db, doc: SourceDocument) -> str | None:
    """唯一性校验：与同企业已解析单据的 LayoutLMv3 文档指纹比较，疑似重复时返回提示。"""
    secret = read_secret(doc.extracted_fields)
    fp = (secret or {}).get("fingerprint") if isinstance(secret, dict) else None
    if not fp:
        return None
    import math

    recent = (
        db.query(SourceDocument)
        .filter(SourceDocument.company_id == doc.company_id,
                SourceDocument.parse_status == "parsed",
                SourceDocument.id != doc.id)
        .order_by(SourceDocument.id.desc())
        .limit(50)
        .all()
    )
    for other in recent:
        other_secret = read_secret(other.extracted_fields)
        ofp = (other_secret or {}).get("fingerprint") if isinstance(other_secret, dict) else None
        if not ofp or len(ofp) != len(fp):
            continue
        dot = sum(a * b for a, b in zip(fp, ofp))
        na = math.sqrt(sum(a * a for a in fp))
        nb = math.sqrt(sum(b * b for b in ofp))
        if na > 0 and nb > 0 and dot / (na * nb) > 0.995:
            return f"疑似与单据 #{other.id}（{other.file_name}）重复"
    return None


@router.post("/{doc_id}/review", status_code=201)
def review_document(doc_id: int, payload: ReviewRequest, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    doc = db.get(SourceDocument, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="单据不存在")
    check_document_access(db, user, doc, write=True)
    from ..models import Company
    db.query(Company).filter(Company.id == doc.company_id).with_for_update().one()
    doc = db.query(SourceDocument).filter(SourceDocument.id == doc_id).with_for_update().populate_existing().one()
    if payload.review_status not in ("confirmed", "rejected"):
        raise HTTPException(status_code=422, detail="无效复核状态")
    if doc.doc_type in ("energy_certificate","revenue_evidence"):
        raise HTTPException(422, "证明文件请在对应的绿电或融资材料业务中使用")
    if doc.review_status == "confirmed":
        return {**_to_dict(doc), "already_confirmed": True, "verify_hint": "此单据已入库，未重复生成业务记录"}
    duplicate_hint = _duplicate_check(db, doc)

    if payload.review_status == "confirmed":
        if doc.content_hash:
            duplicate = db.query(SourceDocument).filter(SourceDocument.company_id == doc.company_id, SourceDocument.content_hash == doc.content_hash, SourceDocument.review_status == "confirmed", SourceDocument.id != doc.id).first()
            if duplicate:
                raise HTTPException(status_code=409, detail=f"相同原始文件已由单据#{duplicate.id}入库，禁止重复计入排放")
        candidate_secret = read_secret(doc.extracted_fields) or {}
        candidate_fields = {**candidate_secret.get("fields", {}), **(payload.fields_override or {})}
        import unicodedata
        def identity(fields):
            def clean(value): return "".join(unicodedata.normalize("NFKC", str(value or "")).split()).casefold()
            number, vendor = clean(fields.get("invoice_no")), clean(fields.get("vendor"))
            return (number, vendor, clean(fields.get("invoice_date"))) if number and vendor else None
        key = identity(candidate_fields) if doc.doc_type == "invoice" else None
        if key:
            recent = db.query(SourceDocument).filter(SourceDocument.company_id == doc.company_id, SourceDocument.review_status == "confirmed", SourceDocument.doc_type == "invoice", SourceDocument.id != doc.id).all()
            for other in recent:
                if identity((read_secret(other.extracted_fields) or {}).get("fields", {})) == key:
                    raise HTTPException(status_code=409, detail=f"相同销售方、发票号和日期已由单据#{other.id}入库，请核查重复票据")
        if doc.verified_status == "failed":
            raise HTTPException(status_code=400,
                                detail="发票验真未通过，禁止入库（请核对后人工修正字段并重新验真）")
        hint = {}
        secret = read_secret(doc.extracted_fields)
        if isinstance(secret, dict):
            hint = secret.get("record_hint") or {}
        fields = (secret or {}).get("fields", {}) if isinstance(secret, dict) else {}
        if payload.fields_override:
            import math
            if any(isinstance(v, float) and not math.isfinite(v) for v in payload.fields_override.values()):
                raise HTTPException(status_code=422, detail="修订数值必须是有限数值")
            fields = {**fields, **payload.fields_override}  # 人工复核修正
            hint = build_record_hint_from_fields(doc.doc_type, fields)

        period = payload.period or hint.get("period") or fields.get("period")
        category = payload.category or hint.get("category")
        scope = payload.scope or hint.get("scope")
        factor_id = payload.factor_id or hint.get("factor_id")
        quantity = payload.quantity if payload.quantity is not None else hint.get("quantity")
        amount = payload.amount if payload.amount is not None else hint.get("amount")
        unit = payload.unit or hint.get("unit")

        if not (category and scope and factor_id) or (quantity is None and amount is None):
            raise HTTPException(status_code=400, detail="缺少可入库的核算字段（category/scope/factor_id/quantity 或 amount）")

        import re
        if not period or not re.fullmatch(r"[1-9][0-9]{3}-(0[1-9]|1[0-2])", period):
            raise HTTPException(status_code=422, detail="请填写真实核算月份，格式为YYYY-MM")
        from ..services.inventory import require_open_period
        require_open_period(db, doc.company_id, period, user.id)
        from ..services.organization import require_period_location, set_activity_location, validate_location
        from ..services.activity import apply_org_names, create_activity_revision
        require_period_location(db, doc.company_id, period, payload.site_id)
        site, unit_obj = validate_location(db, doc.company_id, payload.site_id, payload.org_unit_id)
        from ..services import load_factors_from_db
        from models.core import calculate_record, CalculationError
        factors = load_factors_from_db(db, company_id=doc.company_id)
        try:
            calculate_record({"id": "review", "period": period, "review_status": "confirmed", "category": category, "scope": scope, "factor_id": factor_id, "quantity": quantity, "amount": amount, "unit": unit, "currency": payload.currency}, factors)
        except CalculationError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        secret = dict(secret or {})
        secret["fields"] = fields
        secret["record_hint"] = {"period": period, "category": category, "scope": scope, "factor_id": factor_id, "quantity": quantity, "amount": amount, "unit": unit}
        doc.extracted_fields = store_secret(secret)
        record = BusinessRecord(
            record_no=f"{doc.file_name.split('.')[0][:24]}-{uuid.uuid4().hex[:6]}",
            company_id=doc.company_id,
            period=period,
            category=category,
            scope=scope,
            quantity=quantity,
            unit=unit,
            amount=amount,
            currency=payload.currency,
            factor_id=factor_id,
            review_status="confirmed",
            source="photo",
            document_id=doc.id,
        )
        set_activity_location(record, site, unit_obj)
        apply_org_names(db, record, unit_obj)
        if site:
            record.revisions = [create_activity_revision(record, user.id, "凭证确认入账", version=1)]
        db.add(record)
        doc.review_status = "confirmed"
    else:
        doc.review_status = "rejected"
    doc.reviewed_by_user_id = user.id
    doc.review_note = payload.note
    last_version = db.query(func.max(DocumentReview.version_no)).filter_by(document_id=doc.id).scalar() or 0
    parsed = db.query(DocumentParseRun.id).filter_by(document_id=doc.id, state="parsed").order_by(DocumentParseRun.id.desc()).first()
    db.add(DocumentReview(document_id=doc.id, parse_run_id=parsed[0] if parsed else None,
                          reviewer_id=user.id, version_no=last_version+1, decision=doc.review_status,
                          overrides=store_secret(payload.model_dump(exclude_none=True))))
    db.commit()
    db.refresh(doc)
    if payload.review_status == "confirmed":
        try:
            from ..services.olap import refresh_olap
            refresh_olap(db, doc.company_id)
        except Exception:  # noqa: BLE001
            db.rollback()
    return {**_to_dict(doc), "duplicate_hint": duplicate_hint,
            "verify_hint": "单据未经发票验真（unverified），建议先调用 /verify 查验" if doc.verified_status == "unverified" else None}


def build_record_hint_from_fields(doc_type: str, fields: dict) -> dict:
    from ..services.document_parser import build_record_hint
    return build_record_hint(doc_type, fields)


@router.post("/{doc_id}/verify")
def verify_document(doc_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """发票验真：调用税务授权查验 API；未配置时标记 unverified。"""
    doc = db.get(SourceDocument, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="单据不存在")
    check_document_access(db, user, doc, write=True)
    if doc.doc_type != "invoice":
        raise HTTPException(status_code=422, detail="发票查验只适用于发票")
    doc = db.query(SourceDocument).filter(SourceDocument.id == doc_id).with_for_update().populate_existing().first()
    if doc is None:
        raise HTTPException(status_code=404, detail="单据不存在")
    secret = read_secret(doc.extracted_fields)
    fields = (secret or {}).get("fields", {}) if isinstance(secret, dict) else {}
    from ..services.ai.invoice_verify import verify_invoice

    result = verify_invoice(fields)
    if result["status"] != "unverified":
        doc.verified_status = result["status"]
    db.add(InvoiceVerification(document_id=doc.id, requested_by=user.id,
                               state=result["status"], detail=result["detail"]))
    db.commit()
    return {**_to_dict(doc), "verify_detail": result["detail"], "verify_attempt_status": result["status"]}


@router.get("/{doc_id}/history")
def document_history(doc_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    doc = db.get(SourceDocument, doc_id)
    if not doc:
        raise HTTPException(404, "单据不存在")
    check_document_access(db, user, doc)
    parses = db.query(DocumentParseRun).filter_by(document_id=doc.id).order_by(DocumentParseRun.id.desc()).limit(100)
    reviews = db.query(DocumentReview).filter_by(document_id=doc.id).order_by(DocumentReview.version_no.desc()).limit(100)
    verifications = db.query(InvoiceVerification).filter_by(document_id=doc.id).order_by(InvoiceVerification.id.desc()).limit(100)
    raw = db.get(RawObject, doc.id)
    pages = db.query(DocumentPage).filter_by(document_id=doc.id).order_by(DocumentPage.page_number)
    return {
        "original": {"sha256": raw.sha256, "size_bytes": raw.size_bytes} if raw else None,
        "pages": [{"page": p.page_number, "width_px": p.width_px, "height_px": p.height_px} for p in pages],
        "parses": [{"id": r.id, "job_id": r.job_id, "attempt": r.attempt, "state": r.state, "engine": r.engine,
                    "started_at": r.started_at, "completed_at": r.completed_at} for r in parses],
        "reviews": [{"version": r.version_no, "parse_id": r.parse_run_id, "decision": r.decision,
                     "actor_id": r.reviewer_id, "at": r.decided_at} for r in reviews],
        "verifications": [{"state": r.state, "detail": r.detail, "actor_id": r.requested_by,
                           "at": r.checked_at} for r in verifications],
    }
