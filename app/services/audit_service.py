"""绿色金融审计：穿透核查、区块链哈希存证、审计日志。"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone

from ..crypto import read_secret
from ..models import (
    AuditLog,
    BlockchainAttestation,
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
    run = db.query(CalculationRun).filter(CalculationRun.run_id == run_id).first()
    if not run:
        return {"run_id": run_id, "found": False}

    result = run.result or {}
    items = result.get("items", []) if isinstance(result, dict) else []
    total = result.get("total_kgco2e", 0.0) if isinstance(result, dict) else None

    factors = []
    records = []
    documents = []
    snapshot = read_secret(run.request_snapshot) or {}
    snapshot_records = snapshot.get("payload", {}).get("records", [])

    # 因子溯源
    factor_ids = {i.get("factor_id") for i in items} | {r.get("factor_id") for r in snapshot_records}
    for fid in factor_ids:
        if not fid:
            continue
        f = db.query(EmissionFactor).filter(EmissionFactor.factor_id == fid).first()
        if f:
            factors.append({
                "factor_id": f.factor_id, "category": f.category, "value": f.value,
                "unit": f.unit, "version": f.version, "origin": f.origin, "is_demo": f.is_demo,
            })

    # 明细记录（从结果 items 回填排放量）
    item_emissions = {i.get("record_id"): i for i in items}
    for r in snapshot_records:
        rec_id = r.get("id")
        em = item_emissions.get(rec_id, {})
        doc_id = None
        from ..models import BusinessRecord
        br = db.query(BusinessRecord).filter(BusinessRecord.record_no == rec_id).first()
        if br:
            doc_id = br.document_id
        records.append({
            "record_no": rec_id,
            "period": r.get("period"),
            "category": r.get("category"),
            "scope": r.get("scope"),
            "quantity": r.get("quantity"),
            "amount": r.get("amount"),
            "factor_id": r.get("factor_id"),
            "emissions_kgco2e": em.get("emissions_kgco2e"),
        })
        if doc_id:
            d = db.query(SourceDocument).filter(SourceDocument.id == doc_id).first()
            if d:
                documents.append({
                    "id": d.id, "file_name": d.file_name, "doc_type": d.doc_type,
                    "parse_status": d.parse_status, "ocr_engine": d.ocr_engine,
                })

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
        "documents": documents,
        "audit_logs": audit_logs,
        "algorithm_version": run.algorithm_version,
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
        return _attestation_dict(existing)

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
    return _attestation_dict(att)


def _attestation_dict(att: BlockchainAttestation) -> dict:
    return {
        "run_id": att.run_id,
        "attestation_hash": att.attestation_hash,
        "prev_hash": att.prev_hash,
        "data_summary": att.data_summary,
        "block_height": att.block_height,
        "onchain_time": att.onchain_time.isoformat(),
        "verified": bool(att.attestation_hash) and len(att.attestation_hash) == 64,
    }


def get_attestation(db, run_id: str) -> dict:
    att = db.query(BlockchainAttestation).filter(BlockchainAttestation.run_id == run_id).first()
    if not att:
        return {"run_id": run_id, "attested": False}
    return {"attested": True, **_attestation_dict(att)}


def list_audit_logs(db, run_id: str | None = None, limit: int = 100) -> list[dict]:
    q = db.query(AuditLog).order_by(AuditLog.id.desc())
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
