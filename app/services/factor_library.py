"""官方排放因子库（生态环境部/国家统计局公告口径）与因子集版本管理。

官方值来源：
- 电力：生态环境部、国家统计局《关于发布2022年电力二氧化碳排放因子的公告》(2024-12)：
  全国 0.5703 kgCO2e/kWh（不含市场化交易非化石能源电量）；华中 0.5395；湖南 0.4900。
  《关于发布2024年电力碳足迹因子数据的公告》(2025-10)：全国平均碳足迹因子 0.5777 kgCO2e/kWh（碳足迹口径）。
- 柴油：按《温室气体排放核算方法与报告指南》缺省值热值法：
  42.652 GJ/t × 0.0202 tC/GJ × 98% × 44/12 × 0.84 kg/L ≈ 2.60 kgCO2e/L。
- 汽油：2.37 kgCO2e/L（团体标准常用值，备用）。
- Scope 3 采购类：需由真实投入产出表 + 部门直接排放强度推导（见 io_tables），
  当前无官方值，保留演示因子并标记 is_demo=True。
"""
from __future__ import annotations

OFFICIAL_FACTORS: list[dict] = [
    dict(
        factor_id="MEE_ELEC_2022_NAT",
        category="electricity",
        scope="scope2",
        value=0.5703,
        unit="kgCO2e/kWh",
        version="official-2022",
        origin="生态环境部、国家统计局《关于发布2022年电力二氧化碳排放因子的公告》(2024-12)",
        is_demo=False,
        uncertainty_pct=5.0,
        description="2022年全国电力平均CO2排放因子（不含市场化交易的非化石能源电量）",
    ),
    dict(
        factor_id="MEE_ELEC_2022_HUNAN",
        category="electricity",
        scope="scope2",
        value=0.4900,
        unit="kgCO2e/kWh",
        version="official-2022-hunan",
        origin="生态环境部、国家统计局《关于发布2022年电力二氧化碳排放因子的公告》(2024-12)",
        is_demo=False,
        uncertainty_pct=5.0,
        description="2022年湖南省电力平均CO2排放因子（演示企业所在地口径）",
    ),
    dict(
        factor_id="MEE_ELEC_2022_HZ",
        category="electricity",
        scope="scope2",
        value=0.5395,
        unit="kgCO2e/kWh",
        version="official-2022-hz",
        origin="生态环境部、国家统计局《关于发布2022年电力二氧化碳排放因子的公告》(2024-12)",
        is_demo=False,
        uncertainty_pct=5.0,
        description="2022年华中区域电网电力平均CO2排放因子",
    ),
    dict(
        factor_id="MEE_ELEC_2024_FP",
        category="electricity",
        scope="scope2",
        value=0.5777,
        unit="kgCO2e/kWh",
        version="official-2024-footprint",
        origin="生态环境部、国家统计局、国家能源局《关于发布2024年电力碳足迹因子数据的公告》(2025-10)",
        is_demo=False,
        uncertainty_pct=5.0,
        description="2024年全国电力平均碳足迹因子（碳足迹口径，含输配电，用于产品碳足迹核算）",
    ),
    dict(
        factor_id="MEE_DIESEL_2017",
        category="diesel_combustion",
        scope="scope1",
        value=2.60,
        unit="kgCO2e/L",
        version="official-2022",
        origin="《温室气体排放核算方法与报告指南》缺省值（热值法：42.652GJ/t×0.0202tC/GJ×98%×44/12×0.84kg/L）",
        is_demo=False,
        uncertainty_pct=5.0,
        description="柴油燃烧 CO2 排放因子（按指南缺省参数计算）",
    ),
    dict(
        factor_id="MEE_GASOLINE_2017",
        category="gasoline_combustion",
        scope="scope1",
        value=2.37,
        unit="kgCO2e/L",
        version="official-2022",
        origin="《中国产品全生命周期温室气体排放系数集》常用值",
        is_demo=False,
        uncertainty_pct=5.0,
        description="汽油燃烧 CO2 排放因子（备用类别）",
    ),
]

# 因子集：核算时按业务类别自动选择官方因子（其余类别沿用记录自身因子并给出警告）
FACTOR_SETS: dict[str, dict[str, str]] = {
    "official-2022": {
        "diesel_combustion": "MEE_DIESEL_2017",
        "electricity": "MEE_ELEC_2022_NAT",
    },
    "official-2022-hunan": {
        "diesel_combustion": "MEE_DIESEL_2017",
        "electricity": "MEE_ELEC_2022_HUNAN",
    },
    "official-2022-hz": {
        "diesel_combustion": "MEE_DIESEL_2017",
        "electricity": "MEE_ELEC_2022_HZ",
    },
    "official-2024-footprint": {
        "diesel_combustion": "MEE_DIESEL_2017",
        "electricity": "MEE_ELEC_2024_FP",
    },
}

__all__ = ["OFFICIAL_FACTORS", "FACTOR_SETS"]
