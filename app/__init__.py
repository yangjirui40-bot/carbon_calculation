"""碳速算平台后端应用包。

在导入任何子模块前，先把随包交付的算法包加入 sys.path，
使算法包内部 ``from models.core import ...`` 的相对导入能够解析。
"""
from __future__ import annotations

import sys
from pathlib import Path

_BACKEND_DIR = Path(__file__).resolve().parents[1]
_ALGORITHM_PKG_DIR = _BACKEND_DIR / "algorithm_pkg"

if str(_ALGORITHM_PKG_DIR) not in sys.path:
    sys.path.insert(0, str(_ALGORITHM_PKG_DIR))

__all__ = ["_BACKEND_DIR", "_ALGORITHM_PKG_DIR"]
