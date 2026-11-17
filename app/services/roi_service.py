"""减排投资财务测算：ROI、NPV、回收期。"""
from __future__ import annotations


def compute_roi(
    capex: float,
    annual_opex: float,
    annual_saving: float,
    annual_reduction_kgco2e: float,
    carbon_price: float = 50.0,
    project_life: int = 10,
    discount_rate: float = 0.08,
) -> dict:
    """计算投资回报率（ROI）、净现值（NPV）、动态回收期与逐年现金流。

    碳收益 = 年减排量(kg) / 1000 * 碳价(元/吨)。
    """
    annual_carbon_revenue = annual_reduction_kgco2e / 1000.0 * carbon_price
    annual_net = annual_saving + annual_carbon_revenue - annual_opex

    cumulative = 0.0
    discounted_cumulative = 0.0
    npv = -capex
    cash_flows = []
    payback_year: float | None = None
    discounted_payback_year: float | None = None

    for t in range(1, project_life + 1):
        cumulative += annual_net
        disc = annual_net / ((1 + discount_rate) ** t)
        discounted_cumulative += disc
        npv += disc
        cash_flows.append(
            {
                "year": t,
                "cash_flow": round(annual_net, 2),
                "cumulative": round(cumulative, 2),
                "discounted": round(disc, 2),
                "discounted_cumulative": round(discounted_cumulative, 2),
            }
        )
        if payback_year is None and cumulative >= capex and capex > 0:
            prev = cumulative - annual_net
            payback_year = round((t - 1) + (capex - prev) / annual_net, 2) if annual_net > 0 else None
        if discounted_payback_year is None and discounted_cumulative >= capex and capex > 0:
            prev = discounted_cumulative - disc
            discounted_payback_year = round((t - 1) + (capex - prev) / disc, 2) if disc > 0 else None

    total_net = cumulative
    roi = round(total_net / capex, 4) if capex > 0 else None

    return {
        "capex": capex,
        "annual_opex": annual_opex,
        "annual_saving": annual_saving,
        "annual_reduction_kgco2e": annual_reduction_kgco2e,
        "annual_carbon_revenue": round(annual_carbon_revenue, 2),
        "annual_net_cash_flow": round(annual_net, 2),
        "project_life": project_life,
        "discount_rate": discount_rate,
        "roi": roi,
        "npv": round(npv, 2),
        "payback_period_years": payback_year,
        "discounted_payback_period_years": discounted_payback_year,
        "cash_flows": cash_flows,
    }


__all__ = ["compute_roi"]
