"""LLM 适配器：POMDP-LLM 的"大语言模型推理机"（OpenAI 兼容接口）。

平台设计：POMDP 决策框架在低置信度/勾稽冲突场景触发 LLM 做逻辑推理纠偏。
本模块提供与 OpenAI 兼容 API（如 DeepSeek/Qwen/GLM）的适配；未配置密钥时，
POMDP 引擎使用内置确定性勾稽规则（离线可用），配置后自动启用大模型推理。
"""
from __future__ import annotations

import json
import time

import httpx

from ...config import settings

_client: httpx.Client | None = None
_check_cache: dict = {"at": 0.0, "result": None}


def check_llm() -> dict:
    """校验 LLM 配置可用性（结果缓存 10 分钟）：{enabled, valid, message}。"""
    now = time.time()
    if now - _check_cache["at"] < 600 and _check_cache["result"] is not None:
        return _check_cache["result"]
    if not settings.llm_enabled:
        result = {"enabled": False, "valid": None, "message": "未配置 LLM_API_BASE/LLM_API_KEY（使用内置勾稽规则引擎）"}
    else:
        try:
            resp = httpx.post(
                f"{settings.LLM_API_BASE.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {settings.LLM_API_KEY}"},
                json={"model": settings.LLM_MODEL,
                      "messages": [{"role": "user", "content": "ping"}], "max_tokens": 1},
                timeout=30,
            )
            if resp.status_code == 200:
                result = {"enabled": True, "valid": True, "message": f"LLM 可用（{settings.LLM_MODEL}）"}
            else:
                result = {"enabled": True, "valid": False,
                          "message": f"LLM 校验失败（HTTP {resp.status_code}）：{resp.text[:160]}"}
        except Exception as exc:  # noqa: BLE001
            result = {"enabled": True, "valid": False, "message": f"LLM 连接失败：{exc}"}
    _check_cache.update(at=now, result=result)
    return result


def _get_client() -> httpx.Client | None:
    global _client
    if not settings.llm_enabled:
        return None
    if _client is None:
        _client = httpx.Client(timeout=90.0)
    return _client


def chat(messages: list[dict], temperature: float = 0.0, max_tokens: int = 800) -> str | None:
    client = _get_client()
    if client is None:
        return None
    try:
        resp = client.post(
            f"{settings.LLM_API_BASE.rstrip('/')}/chat/completions",
            headers={"Authorization": f"Bearer {settings.LLM_API_KEY}"},
            json={
                "model": settings.LLM_MODEL,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]
    except Exception:  # noqa: BLE001 - 大模型不可用时回退规则引擎
        return None


def llm_correct_fields(fields: dict, conflicts: list[dict]) -> dict | None:
    """请 LLM 依据财务勾稽规则对冲突字段给出纠偏意见，返回 {field: 建议值}。"""
    prompt = (
        "你是资深财务审计专家。以下票据识别字段存在财务勾稽冲突：\n"
        f"字段：{json.dumps(fields, ensure_ascii=False)}\n"
        f"冲突：{json.dumps(conflicts, ensure_ascii=False)}\n"
        "勾稽规则：数量×单价=不含税金额；不含税金额+税额=价税合计；不含税金额×税率=税额。\n"
        "请输出 JSON：{\"corrections\": {\"字段名\": 修正后的数值}}，仅纠正置信度低的字段。"
    )
    text = chat(
        [
            {"role": "system", "content": "你只输出合法 JSON，不输出任何解释。"},
            {"role": "user", "content": prompt},
        ],
        temperature=0.0,
    )
    if not text:
        return None
    try:
        start = text.find("{")
        end = text.rfind("}")
        if start < 0 or end < 0:
            return None
        return json.loads(text[start : end + 1]).get("corrections")
    except Exception:  # noqa: BLE001
        return None


__all__ = ["chat", "llm_correct_fields", "check_llm"]
