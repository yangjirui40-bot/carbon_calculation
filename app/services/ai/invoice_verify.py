"""Adapter for an explicitly configured, authorized invoice verification service."""
from __future__ import annotations

import hashlib

import httpx

from ...config import settings


def verification_configured():
    if not settings.INVOICE_VERIFY_ENABLED or not settings.INVOICE_VERIFY_API_KEY:
        return False
    try:
        endpoint = httpx.URL(settings.INVOICE_VERIFY_API_BASE)
    except httpx.InvalidURL:
        return False
    return endpoint.scheme == "https" and bool(endpoint.host) and not (
        endpoint.userinfo or endpoint.query or endpoint.fragment
    )


def verify_invoice(fields: dict) -> dict:
    """Let unavailable providers and incomplete OCR data proceed to manual review."""
    if not verification_configured():
        return {"status": "unverified", "detail": "未配置发票查验服务，需人工核对"}
    required = ("invoice_no", "invoice_date", "total_amount")
    if any(fields.get(key) in (None, "") for key in required):
        return {"status": "unverified", "detail": "请先核对发票号码、日期和金额"}
    checksum = hashlib.sha256(
        f"{fields['invoice_no']}|{fields['total_amount']}".encode("utf-8")
    ).hexdigest()[:16]
    try:
        reply = httpx.post(
            f"{settings.INVOICE_VERIFY_API_BASE.rstrip('/')}/verify",
            headers={"Authorization": f"Bearer {settings.INVOICE_VERIFY_API_KEY}"},
            json={"invoice_no": fields["invoice_no"], "date": fields["invoice_date"],
                  "amount": fields["total_amount"], "checksum": checksum},
            timeout=15,
        )
        reply.raise_for_status()
        data = reply.json()
    except (httpx.HTTPError, ValueError):
        return {"status": "unverified", "detail": "查验服务暂不可用，可稍后重试或人工核对"}
    if not isinstance(data, dict) or type(data.get("valid")) is not bool:
        return {"status": "unverified", "detail": "查验结果格式异常，需人工核对"}
    if data["valid"]:
        return {"status": "verified", "detail": "授权查验服务返回有效"}
    return {"status": "failed", "detail": "授权查验服务未通过，请复核票据"}
