import { request } from '../client'
import type {
  DashboardBudget,
  DashboardProduction,
  DashboardDrilldown,
  DashboardRing,
  DashboardSankey,
  DashboardSummary,
  DashboardTrend,
} from '../types'

export function getSummary(companyId: number) {
  return request<DashboardSummary>({
    url: `/api/v1/dashboard/company/${companyId}/summary`,
    method: 'get',
  })
}

export function getRing(companyId: number) {
  return request<DashboardRing>({
    url: `/api/v1/dashboard/company/${companyId}/ring`,
    method: 'get',
  })
}

export function getSankey(companyId: number) {
  return request<DashboardSankey>({
    url: `/api/v1/dashboard/company/${companyId}/sankey`,
    method: 'get',
  })
}

export function getTrend(companyId: number, forecastMonths = 6) {
  return request<DashboardTrend>({
    url: `/api/v1/dashboard/company/${companyId}/trend`,
    method: 'get',
    params: { forecast_months: forecastMonths },
  })
}

export function getDrilldown(companyId: number) {
  return request<DashboardDrilldown>({
    url: `/api/v1/dashboard/company/${companyId}/drilldown`,
    method: 'get',
  })
}

export function getSnapshot(companyId: number, runId?: string) {
  return request<{ summary: DashboardSummary; ring: DashboardRing; trend: DashboardTrend; sankey: DashboardSankey; drilldown: DashboardDrilldown; production: DashboardProduction; budget: DashboardBudget }>({
    url: `/api/v1/dashboard/company/${companyId}/snapshot`,
    method: 'get',
    params: { run_id: runId },
  })
}

export function saveBudget(companyId: number, year: number, kgco2e: number) {
  return request<DashboardBudget>({
    url: `/api/v1/dashboard/company/${companyId}/budgets/${year}`,
    method: 'put',
    data: { annual_limit_kgco2e: kgco2e },
  })
}
