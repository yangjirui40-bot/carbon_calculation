import type {
  CompanyDetail,
  DashboardDrilldown,
  DashboardRing,
  DashboardSankey,
  DashboardSummary,
  DashboardTrend,
} from '../../api/types'

export type DashboardData = {
  company: CompanyDetail
  summary: DashboardSummary
  ring: DashboardRing
  sankey: DashboardSankey
  trend: DashboardTrend
  drilldown: DashboardDrilldown
}
