import type { CalculationResult } from '../api/types'

/**
 * 模拟核算结果。
 * 依据王惠宇三条样例与演示因子：
 * 40 × 2.68 = 107.20；1200 × 0.58 = 696.00；10000 × 0.35 = 3500.00
 * 合计 4303.20 kgCO₂e。
 */
export const mockCalculationResult: CalculationResult = {
  run_id: 'run-001',
  status: 'succeeded',
  total_kgco2e: 4303.2,
  scope_breakdown: {
    scope1: 107.2,
    scope2: 696,
    scope3: 3500,
  },
  calculation_items: [
    {
      transaction_id: 'r001',
      scope: 'scope1',
      category: 'diesel_combustion',
      activity_value: 40,
      activity_unit: 'L',
      factor_id: 'F_DIESEL_01',
      factor_value: 2.68,
      factor_unit: 'kgCO₂e/L',
      emissions_kgco2e: 107.2,
    },
    {
      transaction_id: 'r002',
      scope: 'scope2',
      category: 'electricity',
      activity_value: 1200,
      activity_unit: 'kWh',
      factor_id: 'F_ELEC_01',
      factor_value: 0.58,
      factor_unit: 'kgCO₂e/kWh',
      emissions_kgco2e: 696,
    },
    {
      transaction_id: 'r003',
      scope: 'scope3',
      category: 'electronic_components',
      activity_value: 10000,
      activity_unit: 'CNY',
      factor_id: 'F_EEIO_01',
      factor_value: 0.35,
      factor_unit: 'kgCO₂e/CNY',
      emissions_kgco2e: 3500,
    },
  ],
  factor_version: '2026.10',
  warnings: [
    'Scope 3 仅覆盖“购买的商品与服务”中的采购支出，未覆盖上下游运输与员工通勤。',
  ],
  is_demo: true,
}
