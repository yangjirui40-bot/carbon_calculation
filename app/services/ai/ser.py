"""LayoutXLM SER 关键信息抽取适配器（真实微调模型：Wulolo/layoutxlm-finetuned-xfund-zh）。

平台设计：LayoutLMv3/LayoutXLM 多模态模型对 OCR 词条做语义实体识别（SER），
标注 B-/I-QUESTION（字段名）与 B-/I-ANSWER（字段值），再按版面配对得到键值对。
模型未下载时本引擎自动不可用，流水线回退到版面规则抽取。
"""
from __future__ import annotations

import io

import numpy as np

from ...config import settings

_engine = None
_load_error: str | None = None


def _model_cached(model_id: str) -> bool:
    """模型权重未下载时直接禁用（避免请求路径触发大文件网络下载）。"""
    import os

    name = "models--" + model_id.replace("/", "--")
    path = os.path.join(settings.models_cache_path, name)
    return os.path.isdir(path) and bool(os.listdir(path))


def _get_engine():
    global _engine, _load_error
    if _engine is not None or _load_error is not None:
        return _engine
    if not _model_cached(settings.SER_MODEL):
        _load_error = f"模型未下载：{settings.SER_MODEL}（运行 python -m app.services.ai.provision 下载）"
        return None
    try:
        import os

        os.environ.setdefault("HF_ENDPOINT", settings.HF_ENDPOINT)
        os.environ.setdefault("HF_HOME", settings.models_cache_path)
        import torch  # noqa: F401
        from transformers import AutoModelForTokenClassification, AutoProcessor

        processor = AutoProcessor.from_pretrained(
            settings.SER_MODEL, cache_dir=settings.models_cache_path, apply_ocr=False
        )
        model = AutoModelForTokenClassification.from_pretrained(
            settings.SER_MODEL, cache_dir=settings.models_cache_path
        )
        model.eval()
        _engine = SEREngine(processor, model)
    except Exception as exc:  # noqa: BLE001
        _load_error = f"{type(exc).__name__}: {exc}"
    return _engine


def model_cached() -> bool:
    return _model_cached(settings.SER_MODEL)


def is_loaded() -> bool:
    return _engine is not None


def ser_available() -> bool:
    return _get_engine() is not None


def ser_load_error() -> str | None:
    _get_engine()
    return _load_error


class SEREngine:
    name = "LayoutLMv3-SER(XFUND-zh)"

    def __init__(self, processor, model):
        self.processor = processor
        self.model = model
        self.tokenizer = processor.tokenizer
        self.image_processor = processor.image_processor
        self.labels = {str(k): v for k, v in (model.config.id2label or {}).items()}

    def _forward_labels(self, image, texts, boxes):
        import torch

        tok = self.tokenizer(texts, is_split_into_words=True, add_special_tokens=False)
        word_ids = tok.word_ids()
        max_len = int(getattr(self.model.config, "max_position_embeddings", 512))
        input_ids = [int(self.tokenizer.cls_token_id)] + [int(i) for i in tok["input_ids"]] + [int(self.tokenizer.sep_token_id)]
        bbox = [[0, 0, 0, 0]] + [[int(v) for v in (boxes[wid] if wid is not None else [0, 0, 0, 0])] for wid in word_ids] + [[0, 0, 0, 0]]
        n = len(input_ids)
        input_ids += [int(self.tokenizer.pad_token_id)] * (max_len - n)
        bbox += [[0, 0, 0, 0]] * (max_len - n)
        attention_mask = [1] * n + [0] * (max_len - n)
        img_enc = self.image_processor(images=image, return_tensors="pt")

        with torch.no_grad():
            logits = self.model(
                input_ids=torch.tensor([input_ids]),
                bbox=torch.tensor([bbox]),
                attention_mask=torch.tensor([attention_mask]),
                pixel_values=img_enc["pixel_values"],
            ).logits
        preds = logits[0, 1 : 1 + len(word_ids)].argmax(-1).tolist()
        word_labels = []
        for w in range(len(texts)):
            idxs = [i for i, wid in enumerate(word_ids) if wid == w]
            if not idxs:
                word_labels.append("O")
                continue
            votes = [preds[i] for i in idxs]
            word_labels.append(self.labels[str(max(set(votes), key=votes.count))])
        return word_labels

    @staticmethod
    def _entity(label: str) -> str | None:
        if label.startswith("B-") or label.startswith("I-"):
            return label[2:]
        return None

    def extract(self, image_bytes: bytes, words: list[dict]) -> list[dict]:
        """返回 [(question, answer, question_idx, answer_idx), ...] 键值对。"""
        from PIL import Image

        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        w, h = img.size
        texts = [x["text"] for x in words]
        boxes = [[x["box"][0] / w * 1000, x["box"][1] / h * 1000,
                  x["box"][2] / w * 1000, x["box"][3] / h * 1000] for x in words]
        labels = self._forward_labels(img, texts, boxes)

        # 聚合 BIO 实体
        entities = []
        current = None
        for i, (wd, lab) in enumerate(zip(words, labels)):
            ent = self._entity(lab)
            if lab.startswith("B-") or (ent and (current is None or current[0] != ent)):
                current = (ent, [i])
            elif lab.startswith("I-") and current and current[0] == ent:
                current[1].append(i)
            else:
                if current:
                    entities.append((current[0], current[1]))
                current = None
        if current:
            entities.append((current[0], current[1]))

        pairs = []
        for ent, idxs in entities:
            if ent != "QUESTION":
                continue
            qi = idxs[-1]
            q_box = words[qi]["box"]
            best = None
            for ent2, idxs2 in entities:
                if ent2 != "ANSWER":
                    continue
                ai = idxs2[0]
                a_box = words[ai]["box"]
                if a_box[0] < q_box[2] - 5:
                    continue  # 答案应在问题右侧或下方
                same_line = abs((a_box[1] + a_box[3]) - (q_box[1] + q_box[3])) / 2 <= max(q_box[3] - q_box[1], 1) / 2 + 16
                dist = abs((a_box[1] + a_box[3]) - (q_box[1] + q_box[3])) / 2
                if same_line and (best is None or dist < best[0]):
                    best = (dist, ai)
            if best:
                pairs.append({
                    "question": "".join(words[i]["text"] for i in idxs),
                    "answer": "".join(words[i]["text"] for i in idxs2_of_answer(best[1], entities)),
                    "answer_idx": best[1],
                })
        return pairs


def idxs2_of_answer(ai: int, entities) -> list[int]:
    for ent, idxs in entities:
        if ent == "ANSWER" and idxs and idxs[0] == ai:
            return idxs
    return [ai]


__all__ = ["ser_available", "ser_load_error", "SEREngine"]
