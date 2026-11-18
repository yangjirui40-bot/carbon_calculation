"""LayoutLMv3 多模态文档理解引擎（真实模型：microsoft/layoutlmv3-base-chinese）。

职责（与平台设计一致）：在统一 Transformer 骨干中同时处理文本、2D 位置与图像
三种模态，输出融合后的语义向量；结合版面约束从 OCR 词条中抽取字段值。
模型权重首次使用时自动下载（可通过 HF_ENDPOINT 镜像），未就绪时上层自动回退
到版面规则抽取。
"""
from __future__ import annotations

import io

import numpy as np

from ...config import settings

_engine = None
_load_error: str | None = None


def _get_engine():
    global _engine, _load_error
    if _engine is not None or _load_error is not None:
        return _engine
    import os

    cache = settings.models_cache_path
    name = "models--" + settings.LAYOUT_MODEL.replace("/", "--")
    if not (os.path.isdir(os.path.join(cache, name)) and
            os.listdir(os.path.join(cache, name))):
        _load_error = f"模型未下载：{settings.LAYOUT_MODEL}"
        return None
    try:
        os.environ.setdefault("HF_ENDPOINT", settings.HF_ENDPOINT)
        os.environ.setdefault("HF_HOME", cache)
        # 模型已在本地缓存（model_cached 已校验），禁止联网兜底。
        os.environ.setdefault("HF_HUB_OFFLINE", "1")
        import torch  # noqa: F401
        from transformers import AutoModel, AutoProcessor

        processor = AutoProcessor.from_pretrained(
            settings.LAYOUT_MODEL, cache_dir=cache, apply_ocr=False
        )
        model = AutoModel.from_pretrained(
            settings.LAYOUT_MODEL, cache_dir=cache
        )
        model.eval()
        _engine = LayoutEngine(processor, model)
    except Exception as exc:  # noqa: BLE001
        _load_error = f"{type(exc).__name__}: {exc}"
    return _engine


def model_cached() -> bool:
    import os

    name = "models--" + settings.LAYOUT_MODEL.replace("/", "--")
    path = os.path.join(settings.models_cache_path, name)
    return os.path.isdir(path) and bool(os.listdir(path))


def is_loaded() -> bool:
    return _engine is not None


def layout_engine_available() -> bool:
    return _get_engine() is not None


def layout_load_error() -> str | None:
    _get_engine()
    return _load_error


def _cosine(a: np.ndarray, b: np.ndarray) -> float:
    denom = float(np.linalg.norm(a) * np.linalg.norm(b))
    return float(a @ b) / denom if denom > 1e-9 else 0.0


class LayoutEngine:
    name = "LayoutLMv3"

    def __init__(self, processor, model):
        self.processor = processor
        self.model = model
        self.tokenizer = processor.tokenizer
        self.image_processor = processor.image_processor

    def _blank_image(self):
        from PIL import Image

        return Image.new("RGB", (224, 224), color=(255, 255, 255))

    def _forward(self, image, texts, boxes):
        """手动构造 LayoutLMv3 输入（兼容 transformers v4/v5）：
        分词（is_split_into_words）→ 词级 bbox 对齐 → 图像块编码 → 模型前向。
        """
        import torch

        tok = self.tokenizer(texts, is_split_into_words=True, add_special_tokens=False)
        word_ids = tok.word_ids()
        max_len = int(getattr(self.model.config, "max_position_embeddings", 512))

        input_ids = [int(self.tokenizer.cls_token_id)] + [int(i) for i in tok["input_ids"]]
        bbox_tokens = [[0, 0, 0, 0]]
        for wid in word_ids:
            bbox_tokens.append([int(v) for v in (boxes[wid] if wid is not None else [0, 0, 0, 0])])
        n_body = len(bbox_tokens)
        bbox_tokens.append([0, 0, 0, 0])  # SEP
        input_ids.append(int(self.tokenizer.sep_token_id))
        n = len(input_ids)
        input_ids += [int(self.tokenizer.pad_token_id)] * (max_len - n)
        bbox_tokens += [[0, 0, 0, 0]] * (max_len - n)
        attention_mask = [1] * n + [0] * (max_len - n)

        input_ids_t = torch.tensor([input_ids], dtype=torch.long)
        bbox_t = torch.tensor([bbox_tokens], dtype=torch.long)
        mask_t = torch.tensor([attention_mask], dtype=torch.long)
        img_enc = self.image_processor(images=image, return_tensors="pt")

        with torch.no_grad():
            out = self.model(
                input_ids=input_ids_t,
                bbox=bbox_t,
                attention_mask=mask_t,
                pixel_values=img_enc["pixel_values"],
            )
        hidden = out.last_hidden_state[0]
        cls_vec = hidden[0].numpy()
        word_vecs = []
        for w in range(len(texts)):
            idxs = [i for i, wid in enumerate(word_ids) if wid == w]
            if idxs:
                vec = hidden[1 + idxs[0] : 1 + idxs[-1] + 1].mean(dim=0).numpy()
            else:
                vec = cls_vec
            word_vecs.append(vec)
        return cls_vec, word_vecs

    def embed_document(self, image_bytes: bytes, words: list[dict]) -> dict:
        from PIL import Image

        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        w, h = img.size
        texts = [x["text"] for x in words]
        boxes = [
            [
                x["box"][0] / w * 1000,
                x["box"][1] / h * 1000,
                x["box"][2] / w * 1000,
                x["box"][3] / h * 1000,
            ]
            for x in words
        ]
        cls_vec, word_vecs = self._forward(img, texts, boxes)
        return {"doc_vector": cls_vec, "word_vectors": word_vecs, "words": words}

    def embed_texts(self, texts: list[str]) -> list[np.ndarray]:
        boxes = [[0, 0, 1000, 1000]] * len(texts)
        _cls, word_vecs = self._forward(self._blank_image(), texts, boxes)
        return word_vecs

    def extract_fields(self, image_bytes: bytes, words: list[dict], field_defs: dict[str, list[str]]) -> dict:
        """多模态语义抽取：字段名与 OCR 词条在模型空间做余弦匹配，并结合版面取右侧数值。"""
        emb = self.embed_document(image_bytes, words)
        wvecs = emb["word_vectors"]
        aliases: list[tuple[str, str]] = []
        for field, alist in field_defs.items():
            for a in alist:
                aliases.append((field, a))
        avecs = self.embed_texts([a for _, a in aliases])

        result = {}
        for field in field_defs:
            field_vecs = [avecs[i] for i, (f, _a) in enumerate(aliases) if f == field]
            sims = [max(_cosine(av, wv) for av in field_vecs) for wv in wvecs]
            kw_idx = int(np.argmax(sims))
            kw_sim = float(sims[kw_idx])
            value, conf = self._take_value(words, kw_idx, field)
            result[field] = {
                "value": value,
                "confidence": conf,
                "keyword": words[kw_idx]["text"],
                "keyword_similarity": round(kw_sim, 4),
                "method": "LayoutLMv3-多模态语义+版面",
            }
        return result

    @staticmethod
    def _take_value(words: list[dict], kw_idx: int, field: str) -> tuple:
        """在关键词右侧同行/相邻行取数值型值。"""
        kw = words[kw_idx]
        y0, y1 = kw["box"][1], kw["box"][3]
        kw_x1 = kw["box"][2]
        cands = []
        for i, wd in enumerate(words):
            if i == kw_idx:
                continue
            cx = (wd["box"][0] + wd["box"][2]) / 2
            cy = (wd["box"][1] + wd["box"][3]) / 2
            if cx >= kw_x1 - 5 and abs(cy - (y0 + y1) / 2) <= (y1 - y0) / 2 + 12:
                cands.append(wd)
        cands.sort(key=lambda c: c["box"][0])
        for c in cands:
            parsed = _parse_value(c["text"])
            if parsed is not None:
                return parsed, round(float(c["confidence"]), 4)
        return None, 0.0


def _parse_value(text: str):
    import re

    t = (
        text.strip()
        .replace(",", "")
        .replace("，", "")
        .replace("￥", "")
        .replace("¥", "")
        .replace("元", "")
        .replace(" ", "")
        .replace("％", "%")
    )
    m = re.fullmatch(r"(\d+(?:\.\d+)?)(%?)", t)
    if m:
        val = float(m.group(1))
        return (val / 100.0 if m.group(2) else val)
    return None


__all__ = ["layout_engine_available", "layout_load_error", "LayoutEngine"]
