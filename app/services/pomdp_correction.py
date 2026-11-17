"""POMDP-LLM 智能纠偏引擎（规则化财务勾稽实现）。

原理：将票据字段解析建模为部分可观测马尔可夫决策过程（POMDP）。视觉识别输出带置信度的
“观测”，财务勾稽规则作为“掩码约束”。当约束被违反时，引擎定位置信度最低的字段并依据
勾稽等式反推修正，更新该字段的信念置信度。生产环境可将“推理”步骤替换为大语言模型。

本模块为确定性规则实现，不依赖外部大模型；接口与真实 POMDP-LLM 后端对齐。
"""
from __future__ import annotations

from copy import deepcopy
from typing import Any

# 财务勾稽容差
_TOL = 1e-6


def _rel_diff(a: float, b: float) -> float:
    if abs(b) < _TOL:
        return abs(a - b)
    return abs(a - b) / max(abs(a), abs(b), _TOL)


def _num(fields: dict, key: str) -> float | None:
    v = fields.get(key)
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _detect_conflicts(fields: dict, tolerance: float) -> list[dict]:
    q = _num(fields, "quantity")
    p = _num(fields, "unit_price")
    ex = _num(fields, "tax_exclusive_amount")
    tx = _num(fields, "tax_amount")
    tot = _num(fields, "total_amount")
    rate = _num(fields, "tax_rate")
    conflicts = []
    if q is not None and p is not None and ex is not None and _rel_diff(q * p, ex) > tolerance:
        conflicts.append({"rule": "quantity*unit_price=tax_exclusive_amount", "expect": q * p, "actual": ex})
    if ex is not None and tx is not None and tot is not None and _rel_diff(ex + tx, tot) > tolerance:
        conflicts.append({"rule": "tax_exclusive_amount+tax_amount=total_amount", "expect": ex + tx, "actual": tot})
    if ex is not None and rate is not None and tx is not None and ex != 0 and _rel_diff(ex * rate, tx) > tolerance:
        conflicts.append({"rule": "tax_exclusive_amount*tax_rate=tax_amount", "expect": ex * rate, "actual": tx})
    return conflicts


def correct_fields(
    fields: dict[str, Any],
    confidence: dict[str, float] | None = None,
    tolerance: float = 1e-3,
    use_llm: bool = True,
) -> dict[str, Any]:
    """执行财务勾稽纠偏，返回修正后的字段、置信度与纠偏日志。

    步骤一：确定性勾稽规则（POMDP 信念更新，离线可用）。
    步骤二：若配置了大模型 API，交由 LLM 作为"推理机"复核纠偏结果，
            仅接受通过勾稽校验的建议并记入 llm_review。
    """
    raw = deepcopy(dict(fields))
    raw_conf = dict(confidence or {k: 0.9 for k in fields})
    raw_conflicts = _detect_conflicts(raw, tolerance)

    corrected = deepcopy(raw)
    conf = dict(raw_conf)
    log: list[dict[str, Any]] = []

    def lowest(*keys: str) -> str:
        return min(keys, key=lambda k: conf.get(k, 0.5))

    def fix(field: str, value: float, rule: str, context: dict[str, Any]) -> None:
        before = corrected.get(field)
        corrected[field] = round(value, 8)
        conf[field] = 0.99  # 已依据勾稽规则纠正，信念置信度提升
        log.append(
            {
                "field": field,
                "rule": rule,
                "before": before,
                "after": corrected[field],
                "context": context,
            }
        )

    for _pass in range(3):  # 最多迭代 3 轮，处理级联修正
        changed = False

        q = _num(corrected, "quantity")
        p = _num(corrected, "unit_price")
        ex = _num(corrected, "tax_exclusive_amount")
        tx = _num(corrected, "tax_amount")
        tot = _num(corrected, "total_amount")
        rate = _num(corrected, "tax_rate")

        # 规则1：单价 × 数量 = 不含税金额（价税分离）
        if q is not None and p is not None and ex is not None and _rel_diff(q * p, ex) > tolerance:
            k = lowest("quantity", "unit_price", "tax_exclusive_amount")
            if k == "quantity" and p:
                fix("quantity", ex / p, "unit_price_consistency", {"q*p": q * p, "ex": ex})
            elif k == "unit_price" and q:
                fix("unit_price", ex / q, "unit_price_consistency", {"q*p": q * p, "ex": ex})
            elif k == "tax_exclusive_amount":
                fix("tax_exclusive_amount", q * p, "unit_price_consistency", {"q*p": q * p, "ex": ex})
            changed = True
            q, p, ex = _num(corrected, "quantity"), _num(corrected, "unit_price"), _num(corrected, "tax_exclusive_amount")

        # 规则2：不含税金额 + 税额 = 价税合计
        if ex is not None and tx is not None and tot is not None and _rel_diff(ex + tx, tot) > tolerance:
            k = lowest("tax_exclusive_amount", "tax_amount", "total_amount")
            if k == "tax_exclusive_amount" and tx is not None:
                fix("tax_exclusive_amount", tot - tx, "tax_reconciliation", {"ex+tx": ex + tx, "tot": tot})
            elif k == "tax_amount":
                fix("tax_amount", tot - ex, "tax_reconciliation", {"ex+tx": ex + tx, "tot": tot})
            elif k == "total_amount":
                fix("total_amount", ex + tx, "tax_reconciliation", {"ex+tx": ex + tx, "tot": tot})
            changed = True
            ex, tx, tot = _num(corrected, "tax_exclusive_amount"), _num(corrected, "tax_amount"), _num(corrected, "total_amount")

        # 规则3：不含税金额 × 税率 = 税额
        if ex is not None and rate is not None and tx is not None and ex != 0 and _rel_diff(ex * rate, tx) > tolerance:
            k = lowest("tax_exclusive_amount", "tax_rate", "tax_amount")
            if k == "tax_rate" and ex:
                fix("tax_rate", tx / ex, "tax_rate_consistency", {"ex*rate": ex * rate, "tx": tx})
            elif k == "tax_amount":
                fix("tax_amount", ex * rate, "tax_rate_consistency", {"ex*rate": ex * rate, "tx": tx})
            elif k == "tax_exclusive_amount" and rate:
                fix("tax_exclusive_amount", tx / rate, "tax_rate_consistency", {"ex*rate": ex * rate, "tx": tx})
            changed = True
            ex, rate, tx = _num(corrected, "tax_exclusive_amount"), _num(corrected, "tax_rate"), _num(corrected, "tax_amount")

        if not changed:
            break

    # 步骤二：LLM 复核（仅接受能通过勾稽校验且为数值的建议）
    llm_review: list[dict[str, Any]] = []
    if use_llm and raw_conflicts:
        try:
            from .ai.llm import llm_correct_fields

            suggestions = llm_correct_fields(raw, raw_conflicts) or {}
            for field, value in suggestions.items():
                if field not in ("quantity", "unit_price", "tax_exclusive_amount",
                                 "tax_amount", "total_amount", "tax_rate"):
                    continue
                v = _num({field: value}, field)
                if v is None or v < 0:
                    continue
                candidate = deepcopy(corrected)
                candidate[field] = v
                if _detect_conflicts(candidate, tolerance):
                    continue  # 建议破坏了勾稽一致性，拒绝
                before = corrected.get(field)
                corrected[field] = round(v, 8)
                conf[field] = min(0.97, conf.get(field, 0.9) + 0.05)
                llm_review.append({"field": field, "rule": "llm_review", "before": before,
                                   "after": corrected[field], "engine": "llm"})
        except Exception:  # noqa: BLE001 - LLM 不可用时静默回退
            pass

    return {
        "corrected_fields": corrected,
        "confidence": conf,
        "correction_log": log,
        "corrections_count": len(log),
        "llm_review": llm_review,
    }


__all__ = ["correct_fields"]
