"""真实发票回归集管理工具：把企业真实票据加入 OCR 回归测试集。

用法：
  python -m tests.corpus_manager add <图片路径> --type invoice --truth "{\"total_amount\":11300,...}"
  python -m tests.corpus_manager label <图片路径>   # 交互式打印当前解析结果，辅助标注
  python -m tests.corpus_manager list

标注后的图片复制到 tests/fixtures/corpus/，并写入 ground_truth.json；
运行 python -m tests.test_ocr_corpus 即纳入准确率统计（合成+真实混合回归）。
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "vendor"))

CORPUS_DIR = Path(__file__).resolve().parent / "fixtures" / "corpus"
TRUTH = CORPUS_DIR / "ground_truth.json"


def _load_truth() -> dict:
    return json.loads(TRUTH.read_text(encoding="utf-8")) if TRUTH.exists() else {}


def cmd_add(image: Path, doc_type: str, truth_json: str) -> None:
    if not image.exists():
        raise SystemExit(f"图片不存在：{image}")
    truth = json.loads(truth_json)
    CORPUS_DIR.mkdir(parents=True, exist_ok=True)
    dest = CORPUS_DIR / f"real_{image.name}"
    dest.write_bytes(image.read_bytes())
    data = _load_truth()
    data[dest.name] = {"mode": "real", "doc_type": doc_type, "fields": truth["fields"],
                       "expect_correction": truth.get("expect_correction", False),
                       "source": str(image.resolve())}
    TRUTH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[OK] 已加入回归集：{dest.name}")


def cmd_label(image: Path) -> None:
    if not image.exists():
        raise SystemExit(f"图片不存在：{image}")
    from app.services.document_parser import parse_document

    result = parse_document(image.read_bytes(), "invoice")
    print("当前解析结果（请据此填写 truth 字段）：")
    print(json.dumps(result["extracted_fields"], ensure_ascii=False, indent=2))
    print("纠偏数：", result["corrections_count"])


def cmd_list() -> None:
    data = _load_truth()
    for name, meta in sorted(data.items()):
        print(f"  {name:32s} mode={meta['mode']:14s} fields={len(meta.get('fields', {}))}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    p_add = sub.add_parser("add")
    p_add.add_argument("image")
    p_add.add_argument("--type", default="invoice")
    p_add.add_argument("--truth", required=True)
    p_label = sub.add_parser("label")
    p_label.add_argument("image")
    sub.add_parser("list")
    args = ap.parse_args()
    if args.cmd == "add":
        cmd_add(Path(args.image), args.type, args.truth)
    elif args.cmd == "label":
        cmd_label(Path(args.image))
    elif args.cmd == "list":
        cmd_list()
