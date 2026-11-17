"""敏感数据加密：AES-256-GCM。

对包含财务明细的 JSON 字段（原始凭证解析结果、核算请求快照）做静态加密，
满足"底层核算数据采用 AES-256 规格全量加密"的数据质量要求。
密文以 {"_enc": "aes256gcm", "v": "<base64>"} 形式存入 JSON 列，读写通过
store_secret / read_secret 统一处理，对上层透明。
"""
from __future__ import annotations

import base64
import hashlib
import json
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from .config import settings

_ENV_MARK = "_enc"
_ENV_ALGO = "aes256gcm"


def _key() -> bytes:
    return hashlib.sha256(settings.data_enc_key.encode("utf-8")).digest()


def store_secret(obj) -> dict:
    """将对象加密后包装为可入库的 JSON 标记结构。"""
    if obj is None:
        return None
    data = json.dumps(obj, ensure_ascii=False, default=str).encode("utf-8")
    nonce = os.urandom(12)
    ct = AESGCM(_key()).encrypt(nonce, data, None)
    return {_ENV_MARK: _ENV_ALGO, "v": base64.b64encode(nonce + ct).decode("ascii")}


def read_secret(value):
    """读取入库值：若为加密标记则解密，否则原样返回（兼容历史明文）。"""
    if isinstance(value, dict) and value.get(_ENV_MARK) == _ENV_ALGO and value.get("v"):
        raw = base64.b64decode(value["v"])
        nonce, ct = raw[:12], raw[12:]
        data = AESGCM(_key()).decrypt(nonce, ct, None)
        return json.loads(data.decode("utf-8"))
    return value


__all__ = ["store_secret", "read_secret"]
