"""发票验真适配器：对接税务授权查验服务（OpenAPI 兼容可插拔）。

生产环境需采购国家税务总局授权的第三方发票查验 API（如阿里云/腾讯云/合合信息）。
配置 .env：INVOICE_VERIFY_API_BASE / INVOICE_VERIFY_API_KEY / INVOICE_VERIFY_ENABLED=true。
未配置时单据标记 verified_status=unverified，复核入库需人工确认（系统提示）。
"""
from __future__ import annotations

import hashlib

import httpx

from ...config import settings


def verify_invoice(fields: dict) -> dict:
    """查验发票：返回 {status: verified|failed|unverified, detail}。

    接口契约（OpenAPI 风格）：POST {base}/verify
    {"invoice_no":.., "invoice_code":.., "date":.., "amount":.., "checksum":..}
    → {"valid": true/false, "message": "..."}
    """
    if not getattr(settings, "INVOICE_VERIFY_API_BASE", "") or not getattr(settings, "INVOICE_VERIFY_API_KEY", ""):
        return {"status": "unverified", "detail": "未配置发票查验 API（INVOICE_VERIFY_API_BASE/KEY）"}

    checksum = hashlib.sha256(
        f"{fields.get('invoice_no', '')}|{fields.get('total_amount', '')}".encode("utf-8")
    ).hexdigest()[:16]
    payload = {
        "invoice_no": fields.get("invoice_no"),
        "date": fields.get("invoice_date"),
        "amount": fields.get("total_amount"),
        "checksum": checksum,
    }
    try:
        resp = httpx.post(
            f"{settings.INVOICE_VERIFY_API_BASE.rstrip('/')}/verify",
            headers={"Authorization": f"Bearer {settings.INVOICE_VERIFY_API_KEY}"},
            json=payload,
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        return {"status": "verified" if data.get("valid") else "failed",
                "detail": data.get("message", "")}
    except Exception as exc:  # noqa: BLE001
        return {"status": "unverified", "detail": f"查验服务调用失败：{exc}"}


__all__ = ["verify_invoice"]
