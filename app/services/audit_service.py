"""绿色金融审计：穿透核查、区块链哈希存证、审计日志。"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone

from ..crypto import read_secret
from ..models import (
    AuditLog,
    BlockchainAttestation,
    BusinessRecord,
    CalculationRun,
    EmissionFactor,
    SourceDocument,
)


def add_audit_log(db, action: str, run_id: str | None = None, actor_user_id: int | None = None,
                  source_ip: str | None = None, detail: dict | None = None) -> AuditLog:
    log = AuditLog(action=action, run_id=run_id, actor_user_id=actor_user_id,
                   source_ip=source_ip, detail=detail)
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def _formula(operation: str) -> str:
    if operation == "enterprise":
        return "E_total = E_Scope1 + E_Scope2 + E_Scope3；E_Scope1 = Σ Q_i(柴油) × EF_i；E_Scope2 = Σ Q_i(电力) × EF_i；E_Scope3 = Σ A_j(采购金额) × EF_j"
    if operation == "eiolca":
        return "E = g · (I-A)^(-1) · y，其中 g 为直接排放强度，L=(I-A)^(-1) 为列昂惕夫逆矩阵"
    if operation == "product":
        return "PCF = Σ A_i × EF_i；单位产品 = PCF / Q_output"
    if operation == "scenario":
        return "E' = E_S1 + E_S2(1-r_e) + E_S3(1-r_p)；ΔE = E_baseline - E_scenario"
    return "未知核算模型"


def get_trace(db, run_id: str) -> dict:
    from .run_evidence import evidence_counts, inventory_results

    run = db.query(CalculationRun).filter(CalculationRun.run_id == run_id).first()
    if not run:
        return {"run_id": run_id, "found": False}

    result = run.result or {}
    items = result.get("items", []) if isinstance(result, dict) else []
    total = result.get("total_kgco2e", result.get("total_upstream_emissions_kgco2e")) if isinstance(result, dict) else None

    factors = []
    records = []
    documents = {}
    snapshot = read_secret(run.request_snapshot) or {}
    snapshot_records = snapshot.get("payload", {}).get("records", [])

    frozen_factors = snapshot.get("factor_snapshot") or {}
    # 因子溯源优先使用核算时的加密快照，避免后来修改因子改变历史证据。
    factor_ids = {i.get("factor_id") for i in items} | {r.get("factor_id") for r in snapshot_records}
    for fid in factor_ids:
        if not fid:
            continue
        frozen = frozen_factors.get(fid)
        f = db.query(EmissionFactor).filter(EmissionFactor.factor_id == fid).first()
        if frozen:
            factors.append({**frozen, "snapshot_available": True})
        elif f:
            factors.append({"factor_id": f.factor_id, "category": f.category, "value": f.value,
                            "unit": f.unit, "version": f.version, "origin": f.origin, "is_demo": f.is_demo,
                            "snapshot_available": False, "note": "历史核算未保存因子快照；此处为当前因子，不作历史值证明"})

    # 明细记录（从结果 items 回填排放量）
    item_emissions = {i.get("record_id"): i for i in items}
    archive, archive_inputs = inventory_results(db, run)
    legacy_keys = {row.get("id") for row in snapshot_records if "document_id" not in row}
    legacy_docs = {
        row.record_no: row.document_id for row in db.query(BusinessRecord).filter(
            BusinessRecord.company_id == run.company_id, BusinessRecord.record_no.in_(legacy_keys))
    } if legacy_keys else {}
    doc_ids = {row.get("document_id", legacy_docs.get(row.get("id"))) for row in snapshot_records} - {None}
    documents_by_id = {
        doc.id: doc for doc in db.query(SourceDocument).filter(
            SourceDocument.company_id == run.company_id, SourceDocument.id.in_(doc_ids))
    } if doc_ids else {}
    for line_no, r in enumerate(snapshot_records, 1):
        rec_id = r.get("id")
        emissions = (archive.get(line_no) if archive_inputs else
                     item_emissions.get(rec_id, {}).get("emissions_kgco2e"))
        d = documents_by_id.get(r.get("document_id", legacy_docs.get(rec_id)))
        records.append({
            "record_no": rec_id,
            "period": r.get("period"),
            "category": r.get("category"),
            "scope": r.get("scope"),
            "quantity": r.get("quantity"),
            "amount": r.get("amount"),
            "factor_id": r.get("factor_id"),
            "document_id": d.id if d else None,
            "evidence_link": "snapshot" if "document_id" in r else "current_register",
            "emissions_kgco2e": emissions,
        })
        if d:
            documents[d.id] = {
                "id": d.id, "file_name": d.file_name, "doc_type": d.doc_type,
                "parse_status": d.parse_status, "ocr_engine": d.ocr_engine,
            }
    if run.operation == "product":
        records = [{
            "record_no": item.get("bom_item_id"), "period": None, "category": item.get("category"),
            "scope": "scope3", "quantity": None, "amount": item.get("material_amount_cny"),
            "factor_id": item.get("factor_id"), "emissions_kgco2e": item.get("emissions_kgco2e"),
            "document_id": None,
        } for item in items]

    audit_logs = [
        {"action": l.action, "actor_user_id": l.actor_user_id, "created_at": l.created_at.isoformat()}
        for l in db.query(AuditLog).filter(AuditLog.run_id == run_id).order_by(AuditLog.id).all()
    ]

    return {
        "run_id": run_id,
        "found": True,
        "operation": run.operation,
        "total_kgco2e": total,
        "formula": _formula(run.operation),
        "factors": factors,
        "records": records,
        "documents": list(documents.values()),
        "audit_logs": audit_logs,
        "algorithm_version": run.algorithm_version,
        "lineage": evidence_counts(db, run),
    }


def _canonical_payload(run: CalculationRun) -> bytes:
    payload = {
        "run_id": run.run_id,
        "operation": run.operation,
        "result": run.result,
        "algorithm_version": run.algorithm_version,
    }
    return json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str).encode("utf-8")


def attest(db, run_id: str) -> dict:
    run = db.query(CalculationRun).filter(CalculationRun.run_id == run_id).first()
    if not run:
        return {"run_id": run_id, "found": False}

    existing = db.query(BlockchainAttestation).filter(BlockchainAttestation.run_id == run_id).first()
    if existing:
        return _attestation_dict(existing, run)

    last = db.query(BlockchainAttestation).order_by(BlockchainAttestation.id.desc()).first()
    digest = hashlib.sha256(_canonical_payload(run)).hexdigest()
    prev_hash = last.attestation_hash if last else "0" * 64
    block_height = (last.block_height + 1) if last else 1
    chain_digest = hashlib.sha256((prev_hash + digest).encode("utf-8")).hexdigest()

    att = BlockchainAttestation(
        run_id=run_id,
        attestation_hash=chain_digest,
        prev_hash=prev_hash,
        data_summary={
            "operation": run.operation,
            "total_kgco2e": (run.result or {}).get("total_kgco2e") if isinstance(run.result, dict) else None,
            "algorithm_version": run.algorithm_version,
        },
        block_height=block_height,
        onchain_time=datetime.now(timezone.utc),
    )
    db.add(att)
    db.commit()
    db.refresh(att)
    add_audit_log(db, "attest_blockchain", run_id=run_id, detail={"hash": chain_digest, "block_height": block_height})
    return _attestation_dict(att, run)


def _attestation_dict(att: BlockchainAttestation, run=None) -> dict:
    return {
        "run_id": att.run_id,
        "attestation_hash": att.attestation_hash,
        "prev_hash": att.prev_hash,
        "data_summary": att.data_summary,
        "block_height": att.block_height,
        "onchain_time": att.onchain_time.isoformat(),
        "verified": bool(run and att.attestation_hash == hashlib.sha256((att.prev_hash + hashlib.sha256(_canonical_payload(run)).hexdigest()).encode()).hexdigest()),
        "method": "local-sha256-hash-chain",
        "external_anchor": False,
    }


def get_attestation(db, run_id: str) -> dict:
    att = db.query(BlockchainAttestation).filter(BlockchainAttestation.run_id == run_id).first()
    if not att:
        return {"run_id": run_id, "attested": False}
    run = db.query(CalculationRun).filter(CalculationRun.run_id == run_id).first()
    return {"attested": True, **_attestation_dict(att, run)}


def list_audit_logs(db, run_id: str | None = None, limit: int = 100, user=None) -> list[dict]:
    q = db.query(AuditLog).order_by(AuditLog.id.desc())
    if user is not None and user.role != "admin":
        from sqlalchemy import or_
        from ..models import User
        tenant_runs = db.query(CalculationRun.run_id).filter(CalculationRun.company_id == user.company_id) if user.company_id is not None else db.query(CalculationRun.run_id).filter(False)
        tenant_users = db.query(User.id).filter(User.company_id == user.company_id) if user.company_id is not None else db.query(User.id).filter(User.id == user.id)
        q = q.filter(or_(AuditLog.run_id.in_(tenant_runs), AuditLog.actor_user_id.in_(tenant_users)))
    if run_id:
        q = q.filter(AuditLog.run_id == run_id)
    logs = q.limit(limit).all()
    return [
        {
            "id": l.id, "run_id": l.run_id, "action": l.action,
            "actor_user_id": l.actor_user_id, "source_ip": l.source_ip,
            "detail": l.detail, "created_at": l.created_at.isoformat(),
        }
        for l in logs
    ]


__all__ = ["add_audit_log", "get_trace", "attest", "get_attestation", "list_audit_logs"]
