"""真实 OCR 噪声回归测试：对噪声发票测试集执行完整解析流水线，统计字段级准确率。

用法：python -m tests.test_ocr_corpus
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND / "vendor"))
sys.path.insert(0, str(BACKEND))

from app.services.document_parser import parse_document  # noqa: E402

CORPUS_DIR = BACKEND / "tests" / "fixtures" / "corpus"
NUMERIC_FIELDS = ("total_amount", "tax_amount", "tax_exclusive_amount", "quantity", "unit_price", "tax_rate")


def _close(a, b, rel_tol: float = 0.03, abs_tol: float = 0.5) -> bool:
    if a is None or b is None:
        return False
    return abs(a - b) <= max(rel_tol * max(abs(a), abs(b)), abs_tol)


def main() -> int:
    truth_path = CORPUS_DIR / "ground_truth.json"
    if not truth_path.exists():
        from tests.generate_invoice_corpus import generate
        generate(8)
    truth = json.loads(truth_path.read_text(encoding="utf-8"))

    total_fields = 0
    ok_fields = 0
    detail = {}
    for fname, gt in sorted(truth.items()):
        img = (CORPUS_DIR / fname).read_bytes()
        result = parse_document(img, gt["doc_type"])
        fields = result["extracted_fields"]
        field_ok = {}
        for field in NUMERIC_FIELDS:
            total_fields += 1
            good = _close(fields.get(field), gt["fields"].get(field))
            if good:
                ok_fields += 1
            field_ok[field] = {"expect": gt["fields"].get(field), "got": fields.get(field), "ok": good}
        correction_check = None
        if gt.get("expect_correction"):
            correction_check = result["corrections_count"] >= 1
        detail[fname] = {"mode": gt["mode"], "fields": field_ok,
                         "corrections": result["corrections_count"],
                         "correction_expected": gt.get("expect_correction"),
                         "correction_ok": correction_check}

    acc = ok_fields / max(total_fields, 1)
    print(f"\nOCR 噪声回归：字段准确率 {ok_fields}/{total_fields} = {acc * 100:.1f}%")
    for fname, d in detail.items():
        ok_mark = "".join("O" if v["ok"] else "x" for v in d["fields"].values())
        print(f"  {fname:22s} mode={d['mode']:13s} [{ok_mark}] 纠偏={d['corrections']}"
              + (f"  {'✓纠偏生效' if d['correction_ok'] else '✗纠偏未生效'}" if d['correction_expected'] else ""))

    correction_cases = [d for d in detail.values() if d["correction_expected"]]
    correction_pass = all(d["correction_ok"] for d in correction_cases) if correction_cases else True

    passed = acc >= 0.6 and correction_pass
    print(f"\n结果：{'通过' if passed else '未达标'}（阈值：字段准确率≥60%，不一致票据必须触发 POMDP 纠偏）")
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
