"""单据解析流水线：真实 OCR → 版面/多模态字段抽取 → POMDP-LLM 纠偏 → 碳核算字段映射。

与平台设计对应：
  LayoutLMv3 多模态引擎（视觉感知 + 语义）→ POMDP-LLM（信念更新 + 财务勾稽纠偏）
  → 结构化字段 → 碳核算引擎。
"""
from __future__ import annotations

import re

from .ai import layout as layout_ai
from .ai import ocr as ocr_ai
from .pomdp_correction import correct_fields

# 标准字段定义：字段名 -> 中文关键词别名
FIELD_DEFS: dict[str, list[str]] = {
    "total_amount": ["价税合计", "价税合计(大写)", "合计金额", "总计", "合计"],
    "tax_amount": ["税额"],
    "tax_exclusive_amount": ["不含税金额", "不含税价", "金额"],
    "quantity": ["数量", "电量", "用量", "度数"],
    "unit_price": ["单价"],
    "tax_rate": ["税率"],
    "invoice_date": ["开票日期", "日期"],
    "period": ["所属期", "账期", "月份", "电费年月"],
    "vendor": ["销售方名称", "销方", "收款单位", "户名"],
    "buyer": ["购买方名称", "购方", "付款单位"],
    "invoice_no": ["发票号码", "号码"],
    "meter_no": ["户号", "表号", "用户编号"],
}

_NUMERIC_FIELDS = {"total_amount", "tax_amount", "tax_exclusive_amount", "quantity", "unit_price", "tax_rate"}
_DATE_FIELDS = {"invoice_date", "period"}
_TEXT_FIELDS = {"vendor", "buyer", "invoice_no", "meter_no"}


def _normalize(text: str) -> str:
    out = []
    for ch in text:
        code = ord(ch)
        if code == 0x3000:
            out.append(" ")
        elif 0xFF01 <= code <= 0xFF5E:
            out.append(chr(code - 0xFEE0))
        else:
            out.append(ch)
    return "".join(out).strip()


def _parse_value(text: str):
    t = _normalize(text).replace(",", "").replace("￥", "").replace("¥", "").replace("元", "")
    m = re.fullmatch(r"(\d+(?:\.\d+)?)(%?)", t)
    if m:
        val = float(m.group(1))
        return val / 100.0 if m.group(2) else val
    return None


def _parse_date(text: str) -> str | None:
    t = _normalize(text)
    m = re.search(r"(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})", t)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    m = re.search(r"(\d{4})[-/.](\d{1,2})", t)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}"
    return None


def _parse_remainder(text: str, field: str):
    """从"关键词+值"粘连的词条中解析值（如 税额1300.00 / 数量1000 / 税率13%）。"""
    t = text.strip().lstrip("：:").strip()
    if not t:
        return None
    if field in _NUMERIC_FIELDS:
        return _parse_value(t)
    if field in _DATE_FIELDS:
        return _parse_date(t)
    return t[:64] or None


def _take_value_right(words, norm, kw_idx, field):
    kw = words[kw_idx]
    y0, y1 = kw["box"][1], kw["box"][3]
    kw_x1 = kw["box"][2]
    center_y = (y0 + y1) / 2
    height = max(y1 - y0, 1)

    cands = []
    for i, wd in enumerate(words):
        if i == kw_idx:
            continue
        cx = (wd["box"][0] + wd["box"][2]) / 2
        cy = (wd["box"][1] + wd["box"][3]) / 2
        if cx >= kw_x1 - 5 and abs(cy - center_y) <= height / 2 + 12:
            cands.append(wd)
    cands.sort(key=lambda c: c["box"][0])

    if field in _NUMERIC_FIELDS:
        for c in cands:
            v = _parse_value(c["text"])
            if v is not None:
                return v, float(c["confidence"])
        return None, 0.0
    if field in _DATE_FIELDS:
        for c in cands:
            d = _parse_date(c["text"])
            if d:
                return d, float(c["confidence"])
        return None, 0.0
    # 文本字段：同行右侧 1-3 个词拼接
    parts = []
    for c in cands[:3]:
        if c["text"] in ("：", ":"):
            continue
        parts.append(c["text"])
        if len(parts) >= 2 and field in ("invoice_no", "meter_no"):
            break
    if parts:
        return "".join(parts)[:64], float(cands[0]["confidence"])
    return None, 0.0


def rule_extract(words: list[dict]) -> tuple[dict, dict]:
    """基于真实 OCR 文本与版面坐标的字段抽取。

    匹配优先级：① 词条与别名完全相等 → 取右侧值；② 词条以别名为前缀且剩余部分
    可解析为值（OCR 粘连，如"税额1300.00"）→ 取同词条值；③ 较长别名的子串匹配 → 取右侧值。
    """
    norm = [_normalize(w["text"]) for w in words]
    fields: dict = {}
    confidence: dict = {}
    for field, aliases in FIELD_DEFS.items():
        best = None
        for alias in sorted(aliases, key=len, reverse=True):
            # ② 前缀粘连
            for i, t in enumerate(norm):
                if t.startswith(alias) and len(t) > len(alias):
                    v = _parse_remainder(t[len(alias):], field)
                    if v is not None:
                        best = (v, round(float(words[i]["confidence"]), 4))
                        break
            if best:
                break
            # ① 完全相等 → 右侧值
            for i, t in enumerate(norm):
                if t == alias:
                    value, conf = _take_value_right(words, norm, i, field)
                    if value is not None:
                        best = (value, round(float(words[i]["confidence"]) * max(conf, 0.5), 4))
                        break
            if best:
                break
            # ③ 较长别名的子串匹配 → 右侧值
            if len(alias) >= 3:
                for i, t in enumerate(norm):
                    if alias in t and t != alias and not t.startswith(alias):
                        value, conf = _take_value_right(words, norm, i, field)
                        if value is not None:
                            best = (value, round(float(words[i]["confidence"]) * max(conf, 0.5), 4))
                            break
            if best:
                break
        if best:
            fields[field], confidence[field] = best
        else:
            confidence[field] = 0.0
    return fields, confidence


def layout_fingerprint(image_bytes: bytes, words: list[dict]) -> list[float] | None:
    """LayoutLMv3 真实多模态模型：计算单据融合嵌入（CLS 向量）作为文档指纹。

    用于审计留痕与唯一性校验（相似指纹 = 疑似重复单据）。
    """
    if not layout_ai.layout_engine_available():
        return None
    try:
        emb = layout_ai._get_engine().embed_document(image_bytes, words)
        return [round(float(v), 5) for v in emb["doc_vector"]]
    except Exception:  # noqa: BLE001
        return None


def layout_extract(image_bytes: bytes, words: list[dict]) -> dict | None:
    """LayoutLMv3 语义抽取（预留；基础预训练模型语义检索能力有限，默认不参与字段抽取）。"""
    return None


def ser_extract(image_bytes: bytes, words: list[dict]) -> list[dict] | None:
    """LayoutXLM SER 微调模型关键信息抽取（问题-答案键值对）。"""
    from .ai import ser as ser_ai

    if not ser_ai.ser_available():
        return None
    try:
        return ser_ai._get_engine().extract(image_bytes, words)
    except Exception:  # noqa: BLE001
        return None


def _parse_answer(text: str, field: str):
    if field in _NUMERIC_FIELDS:
        return _parse_value(text)
    if field in _DATE_FIELDS:
        return _parse_date(text)
    t = text.strip().lstrip("：:").strip()
    return t[:64] or None


def _ser_to_fields(pairs: list[dict], words: list[dict]) -> dict:
    """将 SER 键值对映射到标准字段（按字段别名匹配问题文本）。"""
    out: dict = {}
    for pair in pairs:
        question = _normalize(pair.get("question", ""))
        answer = pair.get("answer", "")
        for field, aliases in FIELD_DEFS.items():
            if field in out:
                continue
            if any(question == a or question.startswith(a) for a in sorted(aliases, key=len, reverse=True)):
                v = _parse_answer(answer, field)
                if v is not None:
                    conf = 0.9
                    idx = pair.get("answer_idx")
                    if idx is not None and 0 <= idx < len(words):
                        conf = float(words[idx]["confidence"])
                    out[field] = (v, conf, "LayoutXLM-SER")
                break
    return out


def parse_document(image_bytes: bytes, doc_type: str = "invoice") -> dict:
    """完整解析流水线：OCR → 字段抽取（LayoutXLM SER 多模态 + 版面规则融合）→ POMDP-LLM 纠偏。"""
    ocr = ocr_ai.recognize(image_bytes)
    words = ocr["words"]

    rule_fields, rule_conf = rule_extract(words)
    ser_pairs = ser_extract(image_bytes, words) if settings_use_layout() else None
    ser_fields = _ser_to_fields(ser_pairs, words) if ser_pairs else {}

    raw = dict(rule_fields)
    conf = dict(rule_conf)
    methods: dict = {}
    for field in rule_fields:
        methods[field] = "版面规则"

    # 融合：LayoutXLM SER（微调多模态模型，可用时优先）> 版面规则
    if ser_fields:
        for field, (value, c, method) in ser_fields.items():
            raw[field] = value
            conf[field] = round(c, 4)
            methods[field] = method

    corrected = correct_fields(raw, conf)
    final = corrected["corrected_fields"]
    final_conf = corrected["confidence"]
    fingerprint = layout_fingerprint(image_bytes, words)

    return {
        "doc_type": doc_type,
        "ocr_engine": ocr["engine"],
        "words": words,
        "raw_fields": raw,
        "extracted_fields": final,
        "confidence": final_conf,
        "extraction_methods": methods,
        "correction_log": corrected["correction_log"],
        "llm_review": corrected.get("llm_review", []),
        "corrections_count": corrected["corrections_count"],
        "ser_engine": "LayoutXLM-SER" if ser_fields else None,
        "layout_engine": "LayoutLMv3" if fingerprint is not None else None,
        "fingerprint": fingerprint,
        "record_hint": build_record_hint(doc_type, final),
    }


def settings_use_layout() -> bool:
    from ..config import settings

    return settings.OCR_ENGINE != "mock"


def build_record_hint(doc_type: str, fields: dict) -> dict:
    """将解析字段映射为碳核算业务记录（对应 Scope2 电力 / Scope3 采购）。"""
    period = fields.get("period") or (
        fields.get("invoice_date", "")[:7] if fields.get("invoice_date") else ""
    )
    if doc_type == "electricity_bill":
        return {
            "period": period or None,
            "category": "electricity",
            "scope": "scope2",
            "quantity": fields.get("quantity"),
            "unit": "kWh",
            "factor_id": "DEMO_ELEC_01",
        }
    return {
        "period": period or None,
        "category": "electronic_components",
        "scope": "scope3",
        "amount": fields.get("tax_exclusive_amount"),
        "currency": "CNY",
        "factor_id": "DEMO_EEIO_01",
    }


__all__ = ["parse_document", "rule_extract", "build_record_hint", "FIELD_DEFS"]
