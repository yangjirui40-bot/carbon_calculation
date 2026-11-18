import type { EmissionFactor } from '../api/types'

/** 排放因子表；数值与来源见王惠宇《业务分类与演示数据》 */
export const mockFactors: EmissionFactor[] = [
  {
    factor_id: 'F_DIESEL_01',
    category: 'diesel_combustion',
    factor_value: 2.68,
    factor_unit: 'kgCO₂e/L',
    source: '项目排放因子',
    version: '2026.10',
    is_demo: true,
  },
  {
    factor_id: 'F_ELEC_01',
    category: 'electricity',
    factor_value: 0.58,
    factor_unit: 'kgCO₂e/kWh',
    source: '项目排放因子',
    version: '2026.10',
    is_demo: true,
  },
  {
    factor_id: 'F_EEIO_01',
    category: 'electronic_components',
    factor_value: 0.35,
    factor_unit: 'kgCO₂e/CNY',
    price_basis: '人民币未税',
    source: '项目排放因子',
    version: '2026.10',
    is_demo: true,
  },
  {
    factor_id: 'F_EEIO_02',
    category: 'pcb_materials',
    factor_value: 0.45,
    factor_unit: 'kgCO₂e/CNY',
    price_basis: '人民币未税',
    source: '项目排放因子',
    version: '2026.10',
    is_demo: true,
  },
  {
    factor_id: 'F_EEIO_03',
    category: 'packaging_materials',
    factor_value: 0.12,
    factor_unit: 'kgCO₂e/CNY',
    price_basis: '人民币未税',
    source: '项目排放因子',
    version: '2026.10',
    is_demo: true,
  },
]
