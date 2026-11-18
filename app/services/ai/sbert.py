"""SBERT 语义对齐引擎（真实模型：BAAI/bge-small-zh-v1.5）。

平台设计：SBERT 孪生网络将非标物料名与 153 个国民经济部门描述映射为稠密向量，
以余弦相似度完成匹配。本模块加载真实中文嵌入模型；模型未就绪时回退到
字符 n-gram TF-IDF 余弦相似度（sbert_matcher 内统一调度）。
"""
from __future__ import annotations

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
    name = "models--" + settings.SBERT_MODEL.replace("/", "--")
    if not (os.path.isdir(os.path.join(cache, name)) and
            os.listdir(os.path.join(cache, name))):
        _load_error = f"模型未下载：{settings.SBERT_MODEL}"
        return None
    try:
        os.environ.setdefault("HF_ENDPOINT", settings.HF_ENDPOINT)
        os.environ.setdefault("HF_HOME", cache)
        # 模型已在本地缓存（model_cached 已校验），禁止联网兜底，避免冷启动时
        # huggingface_hub 发起未认证请求导致接口挂起超时。
        os.environ.setdefault("HF_HUB_OFFLINE", "1")
        from sentence_transformers import SentenceTransformer

        model = SentenceTransformer(settings.SBERT_MODEL, cache_folder=cache)
        _engine = SBERTEngine(model)
    except Exception as exc:  # noqa: BLE001
        _load_error = f"{type(exc).__name__}: {exc}"
    return _engine


def model_cached() -> bool:
    import os

    name = "models--" + settings.SBERT_MODEL.replace("/", "--")
    path = os.path.join(settings.models_cache_path, name)
    return os.path.isdir(path) and bool(os.listdir(path))


def is_loaded() -> bool:
    return _engine is not None


def sbert_available() -> bool:
    return _get_engine() is not None


def sbert_load_error() -> str | None:
    _get_engine()
    return _load_error


class SBERTEngine:
    name = "SBERT-bge-small-zh-v1.5"

    def __init__(self, model):
        self.model = model

    def embed(self, texts: list[str]) -> np.ndarray:
        vecs = self.model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
        return np.asarray(vecs, dtype=float)

    def match(self, material: str, candidates: list[dict]) -> dict | None:
        """candidates: [{category,name_zh,description,factor_id}]。返回最佳匹配。"""
        sigs = [f"{c['name_zh']} {c.get('description', '')}" for c in candidates]
        vecs = self.embed([material] + sigs)
        q, rest = vecs[0], vecs[1:]
        sims = [float(q @ r) for r in rest]
        best_i = int(np.argmax(sims))
        return {
            "material_name": material,
            "matched": bool(sims[best_i] >= 0.45),
            "matched_category": candidates[best_i]["category"] if sims[best_i] >= 0.45 else None,
            "matched_factor_id": candidates[best_i].get("factor_id") if sims[best_i] >= 0.45 else None,
            "confidence": round(sims[best_i], 6),
            "engine": self.name,
            "candidates": [
                {"category": c["category"], "name_zh": c["name_zh"], "similarity": round(sims[i], 6)}
                for i, c in enumerate(candidates)
            ],
        }


__all__ = ["sbert_available", "sbert_load_error", "SBERTEngine"]
