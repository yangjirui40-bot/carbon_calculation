"""OCR 引擎：真实文字检测与识别。

默认引擎为 RapidOCR（PP-OCRv4 检测+识别模型，ONNX 推理、CPU 友好、离线可用、
中英文票据识别精度高）。返回词条文本、位置框与识别置信度，作为 LayoutLMv3
多模态模型的输入前端（与平台"OCR 前置 + LayoutLMv3 多模态理解"设计一致）。
"""
from __future__ import annotations

import io

import numpy as np

from ...config import settings

_engine = None


def _load_engine():
    global _engine
    if _engine is not None:
        return _engine
    if settings.OCR_ENGINE == "mock":
        if not settings.DEMO_DATA_ENABLED:
            raise RuntimeError("生产环境禁止模拟OCR")
        _engine = MockEngine()
        return _engine
    try:
        from rapidocr_onnxruntime import RapidOCR

        _engine = RapidOCREngine(RapidOCR())
    except Exception as exc:
        raise RuntimeError("真实OCR引擎不可用，请联系管理员检查依赖；没有生成或代入演示识别结果") from exc
    return _engine


class RapidOCREngine:
    """真实 OCR：PP-OCRv4（检测+方向分类+识别）。"""

    name = "RapidOCR-PP-OCRv4"

    def __init__(self, engine):
        self._engine = engine

    def recognize(self, image_bytes: bytes) -> dict:
        from ..document_media import document_pages
        pages = document_pages(image_bytes)
        words, offset = [], 0
        try:
            for page_no, page in enumerate(pages, start=1):
                result, _elapse = self._engine(np.asarray(page))
                for item in result or []:
                    box, text, score = item[0], item[1], float(item[2])
                    xs, ys = [p[0] for p in box], [p[1] for p in box]
                    words.append({"text": str(text), "box": [int(min(xs)), int(min(ys))+offset, int(max(xs)), int(max(ys))+offset], "confidence": round(score, 4), "page": page_no})
                offset += page.height
        finally:
            for page in pages: page.close()
        return {"engine": self.name, "words": words}


class MockEngine:
    """无依赖回退：模拟一张含噪声的电费单识别结果（仅用于离线演示）。"""

    name = "Mock-Engine(演示)"

    def recognize(self, image_bytes: bytes) -> dict:
        words = [
            {"text": "国网电力有限公司", "box": [60, 20, 300, 44], "confidence": 0.97},
            {"text": "电费通知单", "box": [330, 18, 460, 46], "confidence": 0.98},
            {"text": "户号", "box": [60, 60, 110, 82], "confidence": 0.99},
            {"text": "EC-8821", "box": [130, 60, 220, 82], "confidence": 0.99},
            {"text": "电量(kWh)", "box": [60, 100, 150, 122], "confidence": 0.99},
            {"text": "1200", "box": [170, 100, 230, 122], "confidence": 0.98},
            {"text": "单价(元/kWh)", "box": [260, 100, 380, 122], "confidence": 0.97},
            {"text": "0.62", "box": [400, 100, 450, 122], "confidence": 0.95},
            {"text": "税率", "box": [60, 140, 100, 162], "confidence": 0.90},
            {"text": "13%", "box": [120, 140, 170, 162], "confidence": 0.91},
            {"text": "不含税金额", "box": [260, 140, 360, 162], "confidence": 0.85},
            {"text": "744.00", "box": [380, 140, 460, 162], "confidence": 0.88},
            {"text": "税额", "box": [60, 180, 100, 202], "confidence": 0.88},
            {"text": "96.72", "box": [120, 180, 190, 202], "confidence": 0.87},
            {"text": "价税合计", "box": [260, 180, 360, 202], "confidence": 0.86},
            {"text": "850.72", "box": [380, 180, 470, 202], "confidence": 0.42},  # 噪声
            {"text": "开票日期", "box": [60, 220, 140, 242], "confidence": 0.96},
            {"text": "2026-10-15", "box": [160, 220, 280, 242], "confidence": 0.95},
        ]
        return {"engine": self.name, "words": words}


def recognize(image_bytes: bytes) -> dict:
    return _load_engine().recognize(image_bytes)


__all__ = ["recognize", "RapidOCREngine", "MockEngine"]
