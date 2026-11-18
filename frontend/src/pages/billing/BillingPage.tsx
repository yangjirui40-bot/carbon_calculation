import { App } from 'antd'
import { useState } from 'react'
import { billingApi } from '../../api'
import type { BillingPlan } from '../../api/types'
import {
  SwissEmpty,
  SwissError,
  SwissMasthead,
} from '../../components/swiss'
import { useCompany } from '../../context/CompanyContext'
import { readSession } from '../../router/guards/RequireAuth'
import BillingCompanyPicker from './BillingCompanyPicker'
import PlanGrid from './PlanGrid'
import SubscriptionCard from './SubscriptionCard'
import { toErrorMessage } from './errors'
import { useBillingCompanies } from './useBillingCompanies'
import { useBillingData } from './useBillingData'
import './billing.css'

/**
 * 订阅与用量：企业账号使用会话企业；admin/auditor 通过企业选择器切换。
 * 付费套餐只允许 admin 开通，审计员只读；所有数据来自后端。
 */
export default function BillingPage() {
  const { modal } = App.useApp()
  const session = readSession()
  const role = session?.user.role ?? null
  const sessionCompanyId = session?.user.company_id ?? null
  const isEnterprise = role === 'enterprise'
  const showPicker = role === 'admin' || role === 'auditor'

  const { companyId: contextCompanyId, setCompanyId } = useCompany()
  const companyId = isEnterprise ? sessionCompanyId : contextCompanyId

  const {
    companies,
    loading: companiesLoading,
    error: companiesError,
    reload: reloadCompanies,
  } = useBillingCompanies(showPicker)

  const {
    plans,
    plansLoading,
    plansError,
    subscription,
    subscriptionLoading,
    subscriptionError,
    reload,
  } = useBillingData(companyId)

  const [submittingPlanCode, setSubmittingPlanCode] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const selectedCompany = companies.find((company) => company.id === companyId)
  const companyLabel = selectedCompany
    ? `${selectedCompany.name} · ${selectedCompany.code}`
    : companyId !== null
      ? `企业 #${companyId}`
      : '—'

  function handleCompanyChange(nextCompanyId: number | null) {
    setCompanyId(nextCompanyId)
    setActionMessage(null)
    setActionError(null)
  }

  function handleSelectPlan(plan: BillingPlan) {
    if (companyId === null) return
    const currentPlanName =
      plans.find((item) => item.plan_code === subscription?.plan_code)?.name ??
      subscription?.plan_code?.toUpperCase() ??
      '未订阅'

    modal.confirm({
      title: `切换到「${plan.name}」套餐？`,
      content: `${companyLabel} 当前套餐为「${currentPlanName}」，切换后核算与单据用量将清零，配额按新套餐执行。`,
      okText: '确认切换',
      cancelText: '取消',
      rootClassName: 'swiss-confirm',
      centered: true,
      onOk: async () => {
        setSubmittingPlanCode(plan.plan_code)
        setActionMessage(null)
        setActionError(null)
        try {
          await billingApi.subscribe(companyId, plan.plan_code)
          setActionMessage(`已切换到「${plan.name}」套餐。`)
          reload()
        } catch (error) {
          setActionError(toErrorMessage(error))
        } finally {
          setSubmittingPlanCode(null)
        }
      },
    })
  }

  return (
    <div className="billing-page">
      <SwissMasthead
        kicker="Settings"
        title="订阅与用量"
        description="查看当前套餐、起止日期与核算/单据配额消耗；管理员可为所选企业切换套餐。"
      />

      {showPicker ? (
        <BillingCompanyPicker
          companies={companies}
          value={companyId}
          loading={companiesLoading}
          error={companiesError}
          onChange={handleCompanyChange}
          onRetry={reloadCompanies}
        />
      ) : null}

      {role === 'auditor' ? (
        <p className="billing-note">当前角色为审计员，订阅信息只读。</p>
      ) : null}

      {actionMessage ? (
        <div className="billing-feedback" role="status">
          {actionMessage}
        </div>
      ) : null}
      {actionError ? (
        <div className="billing-feedback billing-feedback--fail" role="alert">
          {actionError}
        </div>
      ) : null}

      {isEnterprise && companyId === null ? (
        <SwissEmpty
          title="账号未绑定企业"
          description="请联系管理员为该账号绑定企业后查看订阅。"
        />
      ) : showPicker && companyId === null ? (
        <SwissEmpty
          title="请选择企业"
          description="订阅与用量按企业隔离；选择企业后加载当前订阅。"
        />
      ) : subscriptionError ? (
        <SwissError message={subscriptionError} onRetry={reload} />
      ) : subscriptionLoading ? (
        <div className="billing-state" role="status">
          正在加载订阅…
        </div>
      ) : subscription ? (
        <SubscriptionCard
          subscription={subscription}
          plans={plans}
          companyLabel={companyLabel}
        />
      ) : null}

      <PlanGrid
        plans={plans}
        loading={plansLoading}
        error={plansError}
        currentPlanCode={subscription?.plan_code}
        subscriptionLoading={companyId !== null && subscriptionLoading}
        role={role}
        hasCompany={companyId !== null}
        submittingPlanCode={submittingPlanCode}
        onSelect={handleSelectPlan}
        onRetry={reload}
      />
    </div>
  )
}
