import { useEffect, useState } from 'react'
import { companiesApi, dashboardApi } from '../../api'
import type { CompanyDetail } from '../../api/types'
import SwissEmpty from '../../components/swiss/SwissEmpty'
import SwissError from '../../components/swiss/SwissError'
import SwissMasthead from '../../components/swiss/SwissMasthead'
import { useCompany } from '../../context/CompanyContext'
import { readSession } from '../../router/guards/RequireAuth'
import CompanyGate from './swiss/CompanyGate'
import DashboardKpis from './swiss/DashboardKpis'
import DrilldownSection from './swiss/DrilldownSection'
import RingSection from './swiss/RingSection'
import SankeySection from './swiss/SankeySection'
import TrendSection from './swiss/TrendSection'
import type { DashboardData } from './types'
import './DashboardPage.css'

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : '驾驶舱数据加载失败'
}

function DashboardSkeleton() {
  return (
    <div className="dash-skeleton" aria-label="驾驶舱加载中" aria-busy="true">
      <div className="dash-skeleton__kpis">
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="dash-skeleton__duo">
        <i />
        <i />
      </div>
      <i className="dash-skeleton__wide" />
      <i className="dash-skeleton__wide" />
    </div>
  )
}

/**
 * 碳排全景驾驶舱：五个区块全部读取后端 dashboard 接口。
 * 页面只负责编排、四态与跳转，不维护任何核算公式。
 */
export default function DashboardPage() {
  const { companyId, setCompanyId } = useCompany()
  const session = readSession()
  const sessionRole = session?.user.role ?? null
  const canSelectCompany = sessionRole !== 'enterprise'
  // 企业账号始终使用会话内绑定的企业，避免继承管理员留在本机的选择
  const resolvedCompanyId = session
    ? sessionRole === 'enterprise'
      ? session.user.company_id
      : (companyId ?? session.user.company_id)
    : null

  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [companies, setCompanies] = useState<CompanyDetail[]>([])
  const [companiesLoading, setCompaniesLoading] = useState(false)
  const [companiesError, setCompaniesError] = useState<string | null>(null)
  const [companiesReloadKey, setCompaniesReloadKey] = useState(0)

  useEffect(() => {
    if (resolvedCompanyId !== null || !canSelectCompany) return
    let active = true
    setCompaniesLoading(true)
    setCompaniesError(null)

    companiesApi
      .listCompanies()
      .then((list) => {
        if (!active) return
        setCompanies(list)
        setCompaniesLoading(false)
      })
      .catch((err) => {
        if (!active) return
        setCompaniesError(errorMessage(err))
        setCompaniesLoading(false)
      })

    return () => {
      active = false
    }
  }, [resolvedCompanyId, canSelectCompany, companiesReloadKey])

  useEffect(() => {
    if (resolvedCompanyId === null) return
    let active = true
    setLoading(true)
    setError(null)
    setData(null)

    Promise.all([
      companiesApi.getCompany(resolvedCompanyId),
      dashboardApi.getSummary(resolvedCompanyId),
      dashboardApi.getRing(resolvedCompanyId),
      dashboardApi.getSankey(resolvedCompanyId),
      dashboardApi.getTrend(resolvedCompanyId, 6),
      dashboardApi.getDrilldown(resolvedCompanyId),
    ])
      .then(([company, summary, ring, sankey, trend, drilldown]) => {
        if (!active) return
        setData({ company, summary, ring, sankey, trend, drilldown })
        setLoading(false)
      })
      .catch((err) => {
        if (!active) return
        setError(errorMessage(err))
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [resolvedCompanyId, reloadKey])

  const description = data
    ? `${data.company.name} · ${data.company.industry} · 报告期 ${data.summary.period ?? '—'}`
    : '解释排放结构、流向、趋势与下钻明细。'

  const showSkeleton = resolvedCompanyId !== null && (loading || (!data && !error))

  return (
    <div className="dash-page">
      <SwissMasthead
        kicker="Carbon panorama"
        title="碳排全景驾驶舱"
        description={description}
      />

      {resolvedCompanyId === null ? (
        canSelectCompany ? (
          <CompanyGate
            companies={companies}
            loading={companiesLoading}
            error={companiesError}
            onSelect={(id) => setCompanyId(id)}
            onRetry={() => setCompaniesReloadKey((key) => key + 1)}
          />
        ) : (
          <SwissEmpty
            title="账号未绑定企业"
            description="请联系管理员为该账号绑定企业后重试。"
          />
        )
      ) : showSkeleton ? (
        <DashboardSkeleton />
      ) : error ? (
        <SwissError message={error} onRetry={() => setReloadKey((key) => key + 1)} />
      ) : data ? (
        <>
          <DashboardKpis summary={data.summary} ring={data.ring} />
          <RingSection ring={data.ring} total={data.summary.total_kgco2e} />
          <SankeySection sankey={data.sankey} />
          <TrendSection trend={data.trend} />
          <DrilldownSection drilldown={data.drilldown} />
        </>
      ) : null}
    </div>
  )
}
