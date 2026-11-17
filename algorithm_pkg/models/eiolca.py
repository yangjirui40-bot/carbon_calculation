"""EIO-LCA 三部门演示模型。

约定：
A[i, j] = 生产 1 CNY 的 j 部门产出，需要投入的 i 部门中间品金额（CNY/CNY）。
g[j] = j 部门直接排放强度（kgCO2e/CNY 部门产出）。
y[j] = 企业对 j 部门产品/服务的最终采购支出（CNY）。
L = (I-A)^(-1)，f = g @ L，E = f @ y。

本模块所有参数均为合成演示参数，不代表真实行业投入产出数据库。
"""
from __future__ import annotations
import numpy as np

class EIOLCAError(ValueError):
    pass

SECTORS = ["electronic_components", "pcb_materials", "packaging_materials"]

# 行为投入部门 i，列为产出部门 j；每列表示生产 1 元该列部门产出所需的中间投入。
A_DEMO = np.array([
    [0.10, 0.05, 0.02],
    [0.08, 0.12, 0.03],
    [0.02, 0.04, 0.08],
], dtype=float)

# 部门直接排放强度，单位 kgCO2e / CNY 部门产出。合成演示参数。
G_DEMO = np.array([0.20, 0.30, 0.08], dtype=float)

def _as_matrix(A):
    arr = np.asarray(A, dtype=float)
    if arr.ndim != 2 or arr.shape[0] != arr.shape[1]:
        raise EIOLCAError("A 必须是方阵")
    if not np.isfinite(arr).all():
        raise EIOLCAError("A 含有 NaN 或无穷值")
    if (arr < 0).any():
        raise EIOLCAError("A 不允许出现负投入系数")
    return arr

def validate_system(A, tolerance=1e-10):
    """检查 A 非负、I-A 可逆，并检查 Hawkins-Simon 主子式条件。"""
    A = _as_matrix(A)
    n = A.shape[0]
    M = np.eye(n) - A
    det = float(np.linalg.det(M))
    cond = float(np.linalg.cond(M))
    if abs(det) <= tolerance:
        raise EIOLCAError("I-A 不可逆或接近奇异")
    if not np.isfinite(cond) or cond > 1e10:
        raise EIOLCAError("I-A 条件数过大，数值不稳定")

    # Hawkins-Simon 条件：I-A 的全部非空主子式均为正。
    # 对所有非空索引子集逐一计算对应的 principal submatrix。
    from itertools import combinations
    principal_minors = {}
    for k in range(1, n + 1):
        for idx in combinations(range(n), k):
            minor_matrix = M[np.ix_(idx, idx)]
            minor = float(np.linalg.det(minor_matrix))
            key = "indices_" + "_".join(str(i + 1) for i in idx)
            principal_minors[key] = minor
            if minor <= tolerance:
                raise EIOLCAError(f"Hawkins-Simon 主子式不为正：{key}")
    rho = float(max(abs(np.linalg.eigvals(A))))
    if rho >= 1 - tolerance:
        raise EIOLCAError("A 的谱半径必须小于 1，Leontief 级数不收敛")
    return {
        "det_I_minus_A": det,
        "condition_number": cond,
        "spectral_radius_A": rho,
        "leading_principal_minors": principal_minors,
    }

def calculate_eiolca(y, A=A_DEMO, g=G_DEMO, sector_names=None):
    """根据采购支出向量 y 计算 EIO-LCA 总排放及部门贡献。"""
    A = _as_matrix(A)
    n = A.shape[0]
    y = np.asarray(y, dtype=float)
    g = np.asarray(g, dtype=float)
    if y.ndim != 1 or y.size != n:
        raise EIOLCAError(f"y 必须是长度为 {n} 的一维向量")
    if g.ndim != 1 or g.size != n:
        raise EIOLCAError(f"g 必须是长度为 {n} 的一维向量")
    if not np.isfinite(y).all() or not np.isfinite(g).all():
        raise EIOLCAError("y 或 g 含有 NaN 或无穷值")
    if (y < 0).any() or (g < 0).any():
        raise EIOLCAError("采购支出 y 和直接排放强度 g 不允许为负")
    if not np.isclose(y.sum(), 0) and (y.sum() <= 0):
        raise EIOLCAError("采购支出总额必须大于 0")

    diagnostics = validate_system(A)
    I = np.eye(n)
    # 用 solve 求解，避免显式求逆带来的数值误差；L 仍作为结果返回供解释展示。
    L = np.linalg.solve(I - A, I)
    f = g @ L
    total = float(f @ y)
    contributions = f * y
    names = sector_names or [f"sector_{i+1}" for i in range(n)]

    return {
        "model": "EIO-LCA",
        "sectors": names,
        "A": A.tolist(),
        "I_minus_A_inverse": L.tolist(),
        "g_kgco2e_per_cny": g.tolist(),
        "y_cny": y.tolist(),
        "f_kgco2e_per_cny": f.tolist(),
        "sector_emissions_kgco2e": {
            names[i]: round(float(contributions[i]), 8) for i in range(n)
        },
        "total_kgco2e": round(total, 8),
        "diagnostics": diagnostics,
        "is_demo": True,
        "parameter_status": "synthetic_demo_not_empirical",
        "unit_note": "g/f: kgCO2e/CNY; y: CNY; E: kgCO2e",
    }

def calculate_demo_bom():
    """项目控制板模块 BOM：7000/2000/1000 元采购金额映射至三个部门。"""
    return calculate_eiolca(
        y=[7000, 2000, 1000],
        A=A_DEMO,
        g=G_DEMO,
        sector_names=SECTORS,
    )
