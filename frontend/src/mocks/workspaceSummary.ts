import type { WorkspaceSummary } from '../api/types'

/**
 * 工作台汇总 Mock。
 * 数据来自 mockCalculationResult（4303.20）与 mockDocuments（6 张，2 张待核对）。
 * 占比为演示值：2.5% + 16.2% + 81.3% = 100%。
 */
export const mockWorkspaceSummary: WorkspaceSummary = {
  company_id: 'demo-001',
  period: '2026-10',
  total_kgco2e: 4303.2,
  document_count: 6,
  needs_review_count: 2,
  calculation_count: 1,
  scope_breakdown: {
    scope1: 107.2,
    scope2: 696,
    scope3: 3500,
  },
  scope_ratio: {
    scope1: 0.025,
    scope2: 0.162,
    scope3: 0.813,
  },
}
