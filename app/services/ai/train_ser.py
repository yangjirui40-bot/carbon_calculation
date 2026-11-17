"""LayoutLMv3 关键信息抽取（SER）微调脚本 —— 平台 KIE 能力的生产化路径。

用法（在具备 GPU 或有标签数据的环境执行）：
  1. 准备标注数据（XFUND-zh 格式：OCR 词条 + boxes + BIO 标签）或直接使用 XFUND-zh 数据集；
  2. python -m app.services.ai.train_ser --data ./data/xfund_zh --out ./models/ser_zh
  3. 将训练产物路径写入 .env 的 SER_MODEL，解析流水线自动启用 LayoutLMv3-SER 引擎。

本脚本基于 microsoft/layoutlmv3-base-chinese 微调 TokenClassification 头
（B-/I-QUESTION、B-/I-ANSWER、B-/I-HEADER、B-/I-OTHER），与平台"视觉感知 +
语义实体识别"设计一致。
"""
from __future__ import annotations

import argparse


def parse_args():
    p = argparse.ArgumentParser(description="LayoutLMv3 SER fine-tuning")
    p.add_argument("--data", required=True, help="XFUND-zh 数据集目录（含 zh_train/zh_val 与标注）")
    p.add_argument("--out", default="./models/ser_zh", help="输出模型目录")
    p.add_argument("--base-model", default="microsoft/layoutlmv3-base-chinese")
    p.add_argument("--epochs", type=int, default=10)
    p.add_argument("--batch-size", type=int, default=2)
    p.add_argument("--lr", type=float, default=2e-5)
    return p.parse_args()


def main() -> None:
    args = parse_args()
    try:
        import torch
        from transformers import (
            AutoProcessor,
            LayoutLMv3ForTokenClassification,
            Trainer,
            TrainingArguments,
        )
    except ImportError as exc:
        raise SystemExit(f"缺少依赖：{exc}（pip install transformers torch datasets）")

    from datasets import Dataset  # noqa: E402

    processor = AutoProcessor.from_pretrained(args.base_model, apply_ocr=False)
    model = LayoutLMv3ForTokenClassification.from_pretrained(
        args.base_model, num_labels=9
    )

    # 读取 XFUND-zh（json 格式：documents -> {img, document:[{text,box,label}...]}）
    import json
    import os
    from PIL import Image

    label2id = {"O": 0, "B-QUESTION": 1, "I-QUESTION": 2, "B-ANSWER": 3,
                "I-ANSWER": 4, "B-HEADER": 5, "I-HEADER": 6, "B-OTHER": 7, "I-OTHER": 8}

    def load_split(split: str):
        path = os.path.join(args.data, f"{split}.json")
        with open(path, encoding="utf-8") as f:
            data = json.load(f)["documents"]
        rows = []
        for doc in data:
            img = Image.open(os.path.join(args.data, doc["img"]["fname"])).convert("RGB")
            words = [d["text"] for d in doc["document"]]
            boxes = [d["box"] for d in doc["document"]]
            labels = [label2id.get(d["label"], 0) for d in doc["document"]]
            enc = processor(images=img, text=words, boxes=boxes, return_tensors="pt")
            rows.append({
                "input_ids": enc["input_ids"][0],
                "bbox": enc["bbox"][0],
                "pixel_values": enc["pixel_values"][0],
                "attention_mask": enc["attention_mask"][0],
                "labels": torch.tensor([-100] + labels + [-100]),
            })
        return rows

    train_rows = load_split("zh_train")
    val_rows = load_split("zh_val")
    train_ds = Dataset.from_list([{k: v.tolist() for k, v in r.items()} for r in train_rows])
    val_ds = Dataset.from_list([{k: v.tolist() for k, v in r.items()} for r in val_rows])

    training_args = TrainingArguments(
        output_dir=args.out,
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        learning_rate=args.lr,
        evaluation_strategy="epoch",
        save_strategy="epoch",
        logging_steps=20,
        remove_unused_columns=False,
    )
    trainer = Trainer(model=model, args=training_args, train_dataset=train_ds, eval_dataset=val_ds)
    trainer.train()
    model.save_pretrained(args.out)
    processor.save_pretrained(args.out)
    print(f"[OK] 模型已保存至 {args.out}；请在 .env 中设置 SER_MODEL={args.out}")


if __name__ == "__main__":
    main()
