import { useEffect, useState } from 'react'
import { calculationsApi, companiesApi, dashboardApi } from '../../api'
import { Link, useSearchParams } from 'react-router-dom'
import type { CalculationRunSummary, CompanyDetail } from '../../api/types'
import SwissEmpty from '../../components/swiss/SwissEmpty'
import SwissError from '../../components/swiss/SwissError'
import SwissMasthead from '../../components/swiss/SwissMasthead'
import { useCompany } from '../../context/CompanyContext'
import { readSession } from '../../router/guards/RequireAuth'
import CompanyGate from './swiss/CompanyGate'
import { StatusStrip, ReviewPanel, ChangeDrivers } from './DecisionOverview'
import DrilldownSection from './swiss/DrilldownSection'
import RingSection from './swiss/RingSection'
import SankeySection from './swiss/SankeySection'
import TrendSection from './swiss/TrendSection'
import BudgetSection from './swiss/BudgetSection'
import { ProductionSection, Scope3Section } from './swiss/ProductionSection'
import SwissTabs from '../../components/swiss/SwissTabs'
import { formatDateTime } from '../../utils/format'
import type { DashboardData } from './types'
import './DashboardPage.css'
import './monitor.css'

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

  const [search, setSearch] = useSearchParams()
  const selectedRun = search.get('run') || undefined
  const selectedScope = search.get('scope') || undefined
  const selectedCategory = search.get('category') || undefined
  const organization = search.get('org') || undefined
  const view = search.get('view') || 'overview'
  const activeView = ['flow', 'detail', 'production', 'scope3'].includes(view) ? view : 'overview'
  const [driverMode,setDriverMode] = useState<'scope'|'category'>('scope')
  const [runs, setRuns] = useState<CalculationRunSummary[]>([])
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
      dashboardApi.getSnapshot(resolvedCompanyId, selectedRun),
      calculationsApi.listRuns({ company_id: resolvedCompanyId }),
    ])
      .then(([company, snapshot, records]) => {
        if (!active) return
        setRuns(records.filter((run) => run.operation === 'enterprise' && run.status === 'success'))
        setData({ company, ...snapshot })
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
  }, [resolvedCompanyId, reloadKey, selectedRun])

  function openRecords(scope: string, category?: string, org?: string) {
    setSearch((previous) => {
      const next = new URLSearchParams(previous)
      next.set('view', 'detail')
      if (data?.summary.run_id) next.set('run', data.summary.run_id)
      next.set('scope', scope)
      if (org) next.set('org', org)
      else next.delete('org')
      if (category) next.set('category', category)
      else next.delete('category')
      return next
    })
  }

  const description = data
    ? `${data.company.name} · ${data.company.industry}`
    : '解释排放结构、流向、趋势与下钻明细。'

  const showSkeleton = resolvedCompanyId !== null && (loading || (!data && !error))

  return (
    <main className="dash-page">
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
        <SwissError message={error} onRetry={() => setReloadKey((key) => key + 1)} backTo={selectedRun ? { to: '/dashboard', label: '查看最新核算' } : undefined} />
      ) : data ? (
        <>
          <div className="dash-context">
            <label>核算快照
              <select value={selectedRun ?? ''} onChange={(event) => setSearch((previous) => {
                const next = new URLSearchParams(previous)
                if (event.target.value) next.set('run', event.target.value)
                else next.delete('run')
                return next
              })}>
                <option value="">最近一次成功核算</option>
                {runs.map((run) => <option key={run.run_id} value={run.run_id}>{data.trend.historical.find(p => p.run_id === run.run_id)?.period || formatDateTime(run.created_at)} · {run.run_id}</option>)}
              </select>
            </label>
            <span>{data.summary.periods?.join('、') || (data.summary.run_id ? '无纳入期间' : '暂无核算快照')}</span>
            {data.summary.run_id ? <Link to={`/audit/runs/${data.summary.run_id}`}>查看核算凭证 ↗</Link> : <Link to="/calculations">进入企业核算 ↗</Link>}
          </div>
          {data.summary.uses_demo_factors || (data.summary.excluded_count ?? 0) > 0 ? (
            <p className="dash-quality" role="status">
              {data.summary.uses_demo_factors ? '含演示因子，仅用于流程验证。' : ''}
              {(data.summary.excluded_count ?? 0) > 0 ? `本快照排除 ${data.summary.excluded_count} 条未确认活动数据。` : ''}
            </p>
          ) : null}
          <StatusStrip data={data} />
          <SwissTabs items={[
            { key: 'overview', label: '全景仪表盘' },
            { key: 'flow', label: '排放流向' },
            { key: 'production', label: '车间与产线' },
            { key: 'scope3', label: '范围 3 分类' },
            { key: 'detail', label: '记录明细' },
          ]} activeKey={activeView} onChange={(key) => setSearch((previous) => {
            const next = new URLSearchParams(previous)
            next.set('view', key)
            next.delete('org')
            next.delete('scope')
            next.delete('category')
            return next
          })} />
          {activeView === 'overview' ? (
            <>
              <div className="bi-top">
                <TrendSection trend={data.trend} />
                <ReviewPanel data={data} onShowActivities={() => setDriverMode('category')} />
              </div>
              <ChangeDrivers key={data.summary.run_id || 'empty'} data={data} onScope={openRecords} mode={driverMode} setMode={setDriverMode} />
              <div className="dash-overview">
                <RingSection ring={data.ring} total={data.summary.total_kgco2e} onScope={openRecords} />
                <SankeySection sankey={data.sankey} onSelect={openRecords} compact />
              </div>
              <nav className="bi-actions" aria-label="后续分析">
                <Link to="/supply-chain">核查供应商风险 <span>→</span></Link>
                {data.summary.run_id && <Link to={`/simulator?run=${data.summary.run_id}`}>按此核算基线模拟减排 <span>→</span></Link>}
              </nav>
              <div id="bi-budget"><BudgetSection key={`${resolvedCompanyId}-${data.budget.year}-${data.budget.annual_limit_kgco2e}`}
                budget={data.budget} companyId={resolvedCompanyId} canWrite={!selectedRun && (sessionRole === 'admin' || sessionRole === 'enterprise')}
                onSaved={() => setReloadKey((key) => key + 1)} /></div>
            </>
          ) : activeView === 'flow' ? (
            <SankeySection sankey={data.sankey} onSelect={openRecords} />
          ) : activeView === 'production' ? (
            <ProductionSection production={data.production} onLocation={(scope, org) => openRecords(scope, undefined, org)} />
          ) : activeView === 'scope3' ? (
            <Scope3Section production={data.production} />
          ) : (
            <DrilldownSection key={`${selectedScope ?? 'all'}-${selectedCategory ?? ''}-${organization ?? ''}`}
              drilldown={data.drilldown} organization={organization} scope={selectedScope} category={selectedCategory} runId={data.summary.run_id} />
          )}
        </>
      ) : null}
    </main>
  )
}
