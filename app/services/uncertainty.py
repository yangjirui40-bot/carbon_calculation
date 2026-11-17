"""不确定性分析与敏感性分析（ISO 14064-1 / ISO 14067 数据质量要求）。

- 误差传播：各项排放视为相互独立，σ_total = sqrt(Σ (E_i × u_i)²)，
  95% 置信区间 ≈ ±1.96σ（正态近似）。
- 敏感性：单因子 ±10% 变动对总量的贡献排名（龙卷风图数据）。
"""
from __future__ import annotations

import math


def analyze(items: list[dict], total: float | None = None) -> dict:
    """items: [{name, emissions_kgco2e, uncertainty_pct}]（可为空表示无数据）。"""
    total = total or sum(i["emissions_kgco2e"] for i in items)
    variance = 0.0
    rows = []
    for i in items:
        e = float(i.get("emissions_kgco2e") or 0.0)
        u = float(i.get("uncertainty_pct") or 0.0) / 100.0
        sigma_i = e * u
        variance += sigma_i * sigma_i
        rows.append({
            "name": i.get("name", ""),
            "emissions_kgco2e": round(e, 4),
            "uncertainty_pct": round(u * 100, 2),
            "sigma_kgco2e": round(sigma_i, 4),
            "contribution_to_variance": round((sigma_i * sigma_i) / variance, 6) if variance > 0 else 0,
        })
    sigma_total = math.sqrt(variance)
    rel = sigma_total / total if total > 0 else 0.0
    return {
        "total_kgco2e": round(total, 4),
        "sigma_total_kgco2e": round(sigma_total, 4),
        "relative_uncertainty": round(rel * 100, 2),
        "ci95_low": round(total - 1.96 * sigma_total, 4),
        "ci95_high": round(total + 1.96 * sigma_total, 4),
        "items": sorted(rows, key=lambda x: -x["sigma_kgco2e"]),
    }


def sensitivity(analyze_fn, base_total: float) -> list[dict]:
    """敏感性：对每个可调因子 ±10%，返回对总量的影响排序。analyze_fn(delta_pct)->total。"""
    results = []
    base = base_total
    for delta in (10.0, -10.0):
        t = analyze_fn(delta / 100.0)
        results.append({"factor": f"全因子{'+10%' if delta > 0 else '-10%'}", "total_kgco2e": t,
                        "delta": t - base})
    return results


def from_run_result(result: dict, factors: dict | None = None) -> dict:
    """从企业/PCF 核算结果构建不确定性分析输入。"""
    items = []
    if isinstance(result, dict):
        for it in result.get("items", []):
            fid = it.get("factor_id")
            u = 10.0  # 默认 ±10%（演示因子缺省假设）
            if factors and fid in factors:
                u = factors[fid].get("uncertainty_pct") or u
            items.append({
                "name": f"{it.get('category', it.get('bom_item_id', ''))} ({fid})",
                "emissions_kgco2e": it.get("emissions_kgco2e", 0.0),
                "uncertainty_pct": u,
            })
    total = (result or {}).get("total_kgco2e") or (result or {}).get("total_upstream_emissions_kgco2e")
    return analyze(items, total=total)


__all__ = ["analyze", "sensitivity", "from_run_result"]
