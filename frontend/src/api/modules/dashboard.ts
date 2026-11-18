import { request } from '../client'
import type {
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
