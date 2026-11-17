"""真实投入产出表接入：2017 年全国 42 部门基本流量表（国家统计局口径）。

数据获取：`data/io/README.md` 提供官方与公开镜像来源；`io2017_42sector.csv` 格式：
  首行 = 42 个部门名称；随后 42 行，每行 = 部门名 + 42 个中间使用值 + 总产出。
导入后：竞争型 A 矩阵 → 进口比例国内化修正 → Leontief 逆 → f = g(I-A)⁻¹。
"""
from __future__ import annotations

import csv
from pathlib import Path

import numpy as np

from ..config import BASE_DIR
from ..services import calculate_eiolca

IO_DIR = BASE_DIR / "data" / "io"

# 2017 年 42 部门名称（国家统计局口径，按表顺序）
SECTORS_42 = [
    "农林牧渔产品和服务", "煤炭采选产品", "石油和天然气开采产品", "金属矿采选产品",
    "非金属矿和其他矿采选产品", "食品和烟草", "纺织品", "纺织服装鞋帽皮革羽绒及其制品",
    "木材加工品和家具", "造纸印刷和文教体育用品", "石油、炼焦产品和核燃料加工品", "化学产品",
    "非金属矿物制品", "金属冶炼和压延加工品", "金属制品", "通用设备", "专用设备",
    "交通运输设备", "电气机械和器材", "通信设备、计算机和其他电子设备", "仪器仪表",
    "其他制造产品和废品废料", "金属制品、机械和设备修理服务", "电力、热力的生产和供应",
    "燃气生产和供应", "水的生产和供应", "建筑", "批发和零售", "交通运输、仓储和邮政",
    "住宿和餐饮", "信息传输、软件和信息技术服务", "金融", "房地产", "租赁和商务服务",
    "研究和试验发展", "综合技术服务", "水利、环境和公共设施管理", "居民服务、修理和其他服务",
    "教育", "卫生和社会工作", "文化、体育和娱乐", "公共管理、社会保障和社会组织",
]

# 平台业务类别 -> 42 部门（含备选，用于 SBERT 粗匹配后的精确映射）
CATEGORY_TO_SECTOR = {
    "electronic_components": ["通信设备、计算机和其他电子设备", "仪器仪表"],
    "pcb_materials": ["通信设备、计算机和其他电子设备", "化学产品"],
    "packaging_materials": ["造纸印刷和文教体育用品"],
    "electricity": ["电力、热力的生产和供应"],
    "diesel_combustion": ["石油、炼焦产品和核燃料加工品"],
}


def load_table(path: str | None = None) -> dict:
    """加载真实 42 部门表，返回 {sectors, Z(万元), X(总产出万元), imports(万元, 可选)}。"""
    path = Path(path) if path else IO_DIR / "io2017_42sector.csv"
    if not path.exists():
        raise FileNotFoundError(f"投入产出表不存在：{path}。请按 data/io/README.md 获取真实数据。")
    rows = list(csv.reader(open(path, encoding="utf-8-sig")))
    headers = [h.strip() for h in rows[0]]
    n = 42
    sector_names = headers[1 : 1 + n]
    Z = np.zeros((n, n))
    X = np.zeros(n)
    M = np.zeros(n)
    for row in rows[1 : 1 + n]:
        name = row[0].strip()
        i = sector_names.index(name) if name in sector_names else None
        if i is None:
            continue
        Z[i, :] = [float(v) for v in row[1 : 1 + n]]
        X[i] = float(row[1 + n]) if len(row) > 1 + n else 0.0
        M[i] = float(row[2 + n]) if len(row) > 2 + n else 0.0
    if X.sum() == 0:
        raise ValueError("表数据为空或格式错误")
    return {"sectors": sector_names, "Z": Z, "X": X, "imports": M}


def build_system(path: str | None = None, domestic: bool = True) -> dict:
    """构建 A 矩阵（万元→CNY 系数口径自动归一）与国内化修正，返回 EIO-LCA 输入。"""
    t = load_table(path)
    X = t["X"]
    A = t["Z"] / np.maximum(X, 1e-12)  # A[i,j] = Z[i,j]/X[j]（列归一）
    if domestic:
        ratio = X / np.maximum(X + t["imports"], 1e-12)
        A = A * ratio[None, :]  # 按行业进口比例折减中间投入（国内化修正）
    return {"A": A.tolist(), "sectors": t["sectors"], "X_wan": X.tolist(),
            "imports_wan": t["imports"].tolist(), "domestic_adjusted": domestic}


def run_eiolca_42(category_amounts: dict[str, float], g: list[float] | None = None,
                  path: str | None = None) -> dict:
    """按业务类别采购金额 → 42 部门需求向量 → EIO-LCA 全链条排放。

    g：42 部门直接排放强度（kgCO2e/万元产出），来自 CEADs 分行业 CO2 排放清单；
    未提供时只返回 Leontief 诊断与总产出乘数（不计算排放）。
    """
    system = build_system(path)
    sectors = system["sectors"]
    y = np.zeros(42)
    mapping_used = {}
    for category, amount in (category_amounts or {}).items():
        targets = CATEGORY_TO_SECTOR.get(category, [])
        idx = None
        for name in targets:
            if name in sectors:
                idx = sectors.index(name)
                break
        if idx is None:
            raise ValueError(f"类别 {category} 无法映射到 42 部门目录")
        y[idx] += float(amount)
        mapping_used[category] = sectors[idx]

    if g is None:
        return {
            "sectors": sectors,
            "A": system["A"],
            "y_wan": y.tolist(),
            "mapping": mapping_used,
            "total_output_multiplier_wan": None,
            "note": "未提供 42 部门直接排放强度 g（CEADs 分行业 CO2 清单），仅返回矩阵与映射。",
        }
    result = calculate_eiolca(y=y, A=system["A"], g=g, sector_names=sectors)
    return {**result, "mapping": mapping_used, "domestic_adjusted": system["domestic_adjusted"]}


__all__ = ["SECTORS_42", "CATEGORY_TO_SECTOR", "load_table", "build_system", "run_eiolca_42"]
