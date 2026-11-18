"""AI 模型预下载脚本：python -m app.services.ai.provision

下载 LayoutLMv3-base-chinese（多模态文档理解）与 bge-small-zh-v1.5（SBERT 语义对齐）
到本地模型缓存目录，避免首次调用时的下载延迟。使用 HF 镜像（可在 .env 配置 HF_ENDPOINT）。
"""
from __future__ import annotations

import os
import sys


def provision() -> dict:
    sys.path.insert(0, str(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))))
    sys.path.insert(0, str(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "vendor")))
    from app.config import settings

    os.environ.setdefault("HF_ENDPOINT", settings.HF_ENDPOINT)
    os.environ.setdefault("HF_HOME", settings.models_cache_path)
    os.makedirs(settings.models_cache_path, exist_ok=True)

    report = {}
    try:
        from huggingface_hub import snapshot_download

        for name, model in (
            ("layout", settings.LAYOUT_MODEL),
            ("ser", settings.SER_MODEL),
            ("sbert", settings.SBERT_MODEL),
        ):
            if not model:  # 未配置的模型跳过（如生产关闭 SER）
                report[name] = {"model": "", "ok": True, "skipped": True}
                print(f"[SKIP] {name}: 未配置模型")
                continue
            try:
                path = snapshot_download(
                    repo_id=model,
                    cache_dir=settings.models_cache_path,
                    local_files_only=False,
                )
                report[name] = {"model": model, "ok": True, "path": path}
                print(f"[OK] {model} -> {path}")
            except Exception as exc:  # noqa: BLE001
                report[name] = {"model": model, "ok": False, "error": str(exc)}
                print(f"[FAIL] {model}: {exc}")
    except ImportError:
        print("[SKIP] 未安装 huggingface_hub；transformers 将在首次使用时自动下载模型。")
        report["note"] = "huggingface_hub not installed"
    return report


if __name__ == "__main__":
    provision()
