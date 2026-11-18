import type { ReductionScenario } from '../api/types'

/**
 * 长期模块 4.6 只读演示数据（不在中期验收范围）。
 * 基准 4303.20；情景结果由程序生成，前端只展示。
 * sc001：仅 Scope 2 电量 -10%，696 → 626.40，合计 4233.60。
 * sc002：Scope 2 -15%（591.60）、Scope 3 -5%（3325.00），合计 4023.80。
 */
export const mockScenarios: ReductionScenario[] = [
  {
    scenario_id: 'sc001',
    scenario_name: '节电 10%',
    baseline_run_id: 'run-001',
    electricity_saving_rate: 0.1,
    procurement_reduction_rate: 0,
    baseline_total_kgco2e: 4303.2,
    scenario_total_kgco2e: 4233.6,
  },
  {
    scenario_id: 'sc002',
    scenario_name: '节电 15% + 采购减少 5%',
    baseline_run_id: 'run-001',
    electricity_saving_rate: 0.15,
    procurement_reduction_rate: 0.05,
    baseline_total_kgco2e: 4303.2,
    scenario_total_kgco2e: 4023.8,
  },
]
