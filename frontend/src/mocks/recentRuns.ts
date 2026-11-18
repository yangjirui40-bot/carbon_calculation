import type { RecentRun } from '../api/types'

/** 工作台“最近核算”列表；第一条与 mockCalculationResult 对应 */
export const mockRecentRuns: RecentRun[] = [
  {
    run_id: 'run-001',
    started_at: '2026-10-18T15:20:00',
    status: 'succeeded',
    total_kgco2e: 4303.2,
  },
  {
    run_id: 'run-000',
    started_at: '2026-10-09T10:05:00',
    status: 'failed',
    error: {
      code: 'FACTOR_MISSING',
      message: '有 1 条记录缺少因子，核算未完成',
    },
  },
]
