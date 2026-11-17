"""AI 引擎包：真实 OCR（RapidOCR/PP-OCRv4）、LayoutLMv3 多模态、SBERT、LLM 适配。"""
from __future__ import annotations

from . import llm, ocr  # noqa: F401

__all__ = ["ocr", "llm"]
