"""智能数据解析厂：原始单据上传（对象存储）、真实 OCR+LayoutLMv3 异步解析、
POMDP-LLM 纠偏、复核入库、AI 引擎状态。"""
from __future__ import annotations

import hashlib
import time
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..crypto import read_secret, store_secret
from ..database import get_db
from ..deps import check_company_access, get_current_user
from ..jobs import register_handler, submit_job
from ..models import BusinessRecord, Job, SourceDocument, User
from ..services.billing_service import enforce_quota
from ..storage import get_storage

router = APIRouter(prefix="/documents", tags=["智能数据解析"])


class ReviewRequest(BaseModel):
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
    try:
        doc = db.get(SourceDocument, int(payload["document_id"]))
        if doc is None:
            return {"ok": False, "error": "document not found"}
        doc.parse_status = "parsing"
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
        db.commit()
        return {"ok": True, "corrections": result["corrections_count"],
                "engine": doc.ocr_engine}
    finally:
        db.close()


register_handler("document_parse", _job_parse_document)


@router.post("/upload", status_code=201)
async def upload_document(
    company_id: int,
    doc_type: str = "invoice",
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    check_company_access(db, user, company_id, write=True)
    enforce_quota(db, company_id, "document")
    content = await file.read()
    content_hash = hashlib.sha256(content).hexdigest()
    # 唯一性拦截：同内容单据直接复用已有档案
    duplicate = db.query(SourceDocument).filter(
        SourceDocument.company_id == company_id, SourceDocument.content_hash == content_hash).first()
    ext = (file.filename or "").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "bin"
    key = f"companies/{company_id}/documents/{uuid.uuid4().hex}.{ext}"
    get_storage().save(key, content)
    doc = SourceDocument(
        company_id=company_id, doc_type=doc_type, file_name=file.filename,
        file_path=key, file_ext=ext, parse_status="uploaded", content_hash=content_hash,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return {**_to_dict(doc),
            "duplicate_hint": f"与单据 #{duplicate.id} 内容完全一致，疑似重复上传" if duplicate else None}


@router.get("")
def list_documents(company_id: int | None = None, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    from ..deps import tenant_company_id
    cid = tenant_company_id(user, company_id)
    q = db.query(SourceDocument).order_by(SourceDocument.id.desc())
    if cid:
        q = q.filter(SourceDocument.company_id == cid)
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
    check_company_access(db, user, doc.company_id)
    return _to_dict(doc)


@router.post("/{doc_id}/parse")
def parse_document_async(doc_id: int, wait: bool = False, db: Session = Depends(get_db),
                         user: User = Depends(get_current_user)):
    """提交异步解析任务（真实 OCR + LayoutLMv3 + POMDP-LLM）。wait=true 时阻塞至完成。"""
    doc = db.get(SourceDocument, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="单据不存在")
    check_company_access(db, user, doc.company_id, write=True)
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
    check_company_access(db, user, doc.company_id, write=True)
    duplicate_hint = _duplicate_check(db, doc)

    if payload.review_status == "confirmed":
        if doc.verified_status == "failed":
            raise HTTPException(status_code=400,
                                detail="发票验真未通过，禁止入库（请核对后人工修正字段并重新验真）")
        hint = {}
        secret = read_secret(doc.extracted_fields)
        if isinstance(secret, dict):
            hint = secret.get("record_hint") or {}
        fields = (secret or {}).get("fields", {}) if isinstance(secret, dict) else {}
        if payload.fields_override:
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

        record = BusinessRecord(
            record_no=f"{doc.file_name.split('.')[0][:24]}-{uuid.uuid4().hex[:6]}",
            company_id=doc.company_id,
            period=period or "1970-01",
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
        db.add(record)
        doc.review_status = "confirmed"
    else:
        doc.review_status = "rejected"
    doc.reviewed_by_user_id = user.id
    doc.review_note = payload.note
    db.commit()
    db.refresh(doc)
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
    check_company_access(db, user, doc.company_id, write=True)
    secret = read_secret(doc.extracted_fields)
    fields = (secret or {}).get("fields", {}) if isinstance(secret, dict) else {}
    from ..services.ai.invoice_verify import verify_invoice

    result = verify_invoice(fields)
    doc.verified_status = result["status"]
    db.commit()
    return {**_to_dict(doc), "verify_detail": result["detail"]}
