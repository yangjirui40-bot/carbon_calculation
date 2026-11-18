import type { BillingPlan } from '../../api/types'
import {
  SwissButton,
  SwissEmpty,
  SwissError,
  SwissSection,
} from '../../components/swiss'
import type { Role } from '../../config/roles'
import { formatNumber } from '../../utils/format'
import { planPriceText, resolvePlanAction, type PlanAction } from './labels'

type PlanGridProps = {
  plans: BillingPlan[]
  loading: boolean
  error: string | null
  currentPlanCode: string | undefined
  subscriptionLoading: boolean
  role: Role | null
  hasCompany: boolean
  submittingPlanCode: string | null
  onSelect: (plan: BillingPlan) => void
  onRetry: () => void
}

/** 套餐列表：价格、配额、功能点与当前套餐标记；按钮状态按角色与订阅决定 */
export default function PlanGrid({
  plans,
  loading,
  error,
  currentPlanCode,
  subscriptionLoading,
  role,
  hasCompany,
  submittingPlanCode,
  onSelect,
  onRetry,
}: PlanGridProps) {
  return (
    <SwissSection
      kicker="Plans"
      title="套餐列表"
      extra={plans.length > 0 ? `${plans.length} 个套餐` : undefined}
    >
      {error ? (
        <SwissError message={error} onRetry={onRetry} />
      ) : loading && plans.length === 0 ? (
        <div className="billing-state" role="status">
          正在加载套餐…
        </div>
      ) : plans.length === 0 ? (
        <SwissEmpty title="暂无套餐" description="后端没有返回可展示的套餐。" />
      ) : (
        <div className="billing-plan-grid">
          {plans.map((plan) => {
            const isCurrent = currentPlanCode === plan.plan_code
            const action: PlanAction = subscriptionLoading
              ? { enabled: false, label: '加载中…' }
              : resolvePlanAction({ plan, currentPlanCode, role, hasCompany })
            const features = plan.features ?? []

            return (
              <article
                key={plan.plan_code}
                className={`billing-plan${isCurrent ? ' billing-plan--current' : ''}`}
              >
                <header className="billing-plan__head">
                  <span className="billing-plan__code">{plan.plan_code.toUpperCase()}</span>
                  {isCurrent ? <span className="billing-plan__current">当前套餐</span> : null}
                </header>
                <h3 className="billing-plan__name">{plan.name}</h3>
                <div className="billing-plan__price">{planPriceText(plan)}</div>

                <dl className="billing-plan__quota">
                  <div>
                    <dt>年核算配额</dt>
                    <dd>{formatNumber(plan.quota_calculations, 0)} 次</dd>
                  </div>
                  <div>
                    <dt>年单据配额</dt>
                    <dd>{formatNumber(plan.quota_documents, 0)} 份</dd>
                  </div>
                </dl>

                <ul className="billing-plan__features">
                  {features.length > 0 ? (
                    features.map((feature) => <li key={feature}>{feature}</li>)
                  ) : (
                    <li className="is-empty">暂无功能说明</li>
                  )}
                </ul>

                <div className="billing-plan__action">
                  <SwissButton
                    variant={action.enabled ? 'primary' : 'ghost'}
                    disabled={!action.enabled}
                    loading={submittingPlanCode === plan.plan_code}
                    aria-label={`${action.label}：${plan.name}`}
                    onClick={() => onSelect(plan)}
                  >
                    {action.label}
                  </SwissButton>
                  {action.reason ? (
                    <p className="billing-plan__reason">{action.reason}</p>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </SwissSection>
  )
}
