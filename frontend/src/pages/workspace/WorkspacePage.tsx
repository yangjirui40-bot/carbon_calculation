import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  billingApi,
  calculationsApi,
  companiesApi,
  dashboardApi,
  documentsApi,
} from '../../api'
import type {
  CalculationRunSummary,
  CompanyDetail,
  DashboardSummary,
  SubscriptionInfo,
} from '../../api/types'
import SwissEmpty from '../../components/swiss/SwissEmpty'
import SwissError from '../../components/swiss/SwissError'
import SwissMasthead from '../../components/swiss/SwissMasthead'
import { useCompany } from '../../context/CompanyContext'
import { readSession } from '../../router/guards/RequireAuth'
import CompanySelector from './swiss/CompanySelector'
import RecentRuns from './swiss/RecentRuns'
import ScopeList from './swiss/ScopeList'
import SubscriptionPanel from './swiss/SubscriptionPanel'
import WorkspaceHero from './swiss/WorkspaceHero'
import WorkspaceMetrics from './swiss/WorkspaceMetrics'
import './WorkspacePage.css'

type WorkspaceData = {
  company: CompanyDetail
  summary: DashboardSummary
  documentCount: number
  reviewCount: number
  runs: CalculationRunSummary[]
  subscription: SubscriptionInfo | null
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : '工作台数据加载失败'
}

function WorkspaceSkeleton() {
  return (
    <div className="ws-skeleton" aria-label="工作台加载中" aria-busy="true">
      <div className="ws-skeleton__hero">
        <span className="ws-skeleton__line is-total" />
        <span className="ws-skeleton__line is-meta" />
      </div>
      <div className="ws-skeleton__row">
        <i />
        <i />
        <i />
      </div>
      <span className="ws-skeleton__line is-table" />
    </div>
  )
}

/**
 * 企业工作台：数据全部来自后端，页面只做展示与跳转。
 * 导航与品牌由全局 SwissAppShell 提供，本页不再带侧栏或整页壳层。
 */
export default function WorkspacePage() {
  const navigate = useNavigate()
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

  const [data, setData] = useState<WorkspaceData | null>(null)
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

    // 审计员不能传 company_id（后端会按租户隔离拒绝），改由前端按企业过滤
    const scopedCompanyId =
      sessionRole === 'auditor' ? undefined : resolvedCompanyId
    const companyParams =
      scopedCompanyId === undefined ? {} : { company_id: scopedCompanyId }

    Promise.all([
      companiesApi.getCompany(resolvedCompanyId),
      dashboardApi.getSummary(resolvedCompanyId),
      documentsApi.listDocuments(companyParams),
      documentsApi.getReviewQueue(companyParams),
      calculationsApi.listRuns(companyParams),
      billingApi.getSubscription(resolvedCompanyId).catch(() => null),
    ])
      .then(([company, summary, documents, reviewQueue, runs, subscription]) => {
        if (!active) return
        const scopedDocuments =
          scopedCompanyId === undefined
            ? documents.filter((item) => item.company_id === resolvedCompanyId)
            : documents
        const scopedRuns =
          scopedCompanyId === undefined
            ? runs.filter((item) => item.company_id === resolvedCompanyId)
            : runs
        const scopedReviewCount =
          scopedCompanyId === undefined
            ? reviewQueue.queue.filter((item) =>
                scopedDocuments.some((doc) => doc.id === item.id),
              ).length
            : reviewQueue.count
        setData({
          company,
          summary,
          documentCount: scopedDocuments.length,
          reviewCount: scopedReviewCount,
          runs: scopedRuns,
          subscription,
        })
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
  }, [resolvedCompanyId, sessionRole, reloadKey])

  const description = data
    ? `${data.company.name} · ${data.company.industry} · 报告期 ${data.summary.period ?? '—'}`
    : '汇总单据、核算与 Scope 结果，并提供最近核算入口。'

  const showSkeleton =
    resolvedCompanyId !== null && (loading || (!data && !error))

  return (
    <div className="ws-page">
      <SwissMasthead
        kicker="Enterprise workspace"
        title="企业工作台"
        description={description}
      />

      {resolvedCompanyId === null ? (
        canSelectCompany ? (
          <CompanySelector
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
        <WorkspaceSkeleton />
      ) : error ? (
        <SwissError message={error} onRetry={() => setReloadKey((key) => key + 1)} />
      ) : data ? (
        <>
          <WorkspaceHero
            company={data.company}
            summary={data.summary}
            onUpload={() => navigate('/documents')}
            onManual={() => navigate('/records')}
            onCalculate={() => navigate('/calculations')}
          />

          {data.summary.total_kgco2e > 0 ? <ScopeList summary={data.summary} /> : null}

          <WorkspaceMetrics
            documentCount={data.documentCount}
            reviewCount={data.reviewCount}
            runCount={data.runs.length}
          />

          <div className={data.subscription ? 'ws-split' : 'ws-split ws-split--single'}>
            <RecentRuns runs={data.runs} />
            {data.subscription ? (
              <SubscriptionPanel subscription={data.subscription} />
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  )
}
