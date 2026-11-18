import type { BillingPlan, SubscriptionInfo } from '../../api/types'
import SwissSection from '../../components/swiss/SwissSection'
import SwissStat from '../../components/swiss/SwissStat'
import { formatNumber, formatPercent } from '../../utils/format'
import {
  formatDate,
  subscriptionStatusText,
  subscriptionStatusTone,
  usageRatio,
  usageText,
  usageTone,
} from './labels'

type SubscriptionCardProps = {
  subscription: SubscriptionInfo
  plans: BillingPlan[]
  companyLabel: string
}

type QuotaMeterProps = {
  label: string
  usage: number
  quota: number | null | undefined
  unit: string
}

function QuotaMeter({ label, usage, quota, unit }: QuotaMeterProps) {
  const ratio = usageRatio(usage, quota)
  const tone = usageTone(usage, quota)
  const width = ratio === null ? 0 : Math.min(ratio, 1) * 100
  const hasQuota = typeof quota === 'number' && Number.isFinite(quota) && quota > 0
  const ariaNow = hasQuota ? Math.min(usage, quota) : undefined

  return (
    <div className={`billing-meter billing-meter--${tone}`}>
      <div className="billing-meter__head">
        <span>{label}</span>
        <span className="billing-meter__value">{usageText(usage, quota, unit)}</span>
      </div>
      <div
        className="billing-meter__track"
        role={hasQuota ? 'progressbar' : undefined}
        aria-label={hasQuota ? label : undefined}
        aria-valuemin={hasQuota ? 0 : undefined}
        aria-valuemax={hasQuota ? quota : undefined}
        aria-valuenow={ariaNow}
      >
        <span className="billing-meter__fill" style={{ width: `${width}%` }} />
      </div>
      <div className="billing-meter__hint">
        {ratio === null
          ? typeof quota === 'number'
            ? '配额为 0'
            : '配额未设置'
          : `已用 ${formatPercent(ratio)}${usageTone(usage, quota) === 'fail' ? ' · 已用尽' : ''}`}
      </div>
    </div>
  )
}

/** 当前订阅：套餐、状态、起止、两项用量进度与剩余核算次数 */
export default function SubscriptionCard({
  subscription,
  plans,
  companyLabel,
}: SubscriptionCardProps) {
  const plan = plans.find((item) => item.plan_code === subscription.plan_code)
  const planName = plan ? plan.name : subscription.plan_code.toUpperCase()
  const tone = subscriptionStatusTone(subscription.status)
  const remaining = subscription.remaining_calculations
  const remainingTone =
    typeof remaining === 'number' ? (remaining <= 0 ? 'fail' : 'accent') : 'default'

  return (
    <SwissSection kicker="Current subscription" title="当前订阅" extra={companyLabel}>
      <div className="billing-current">
        <div className="billing-current__head">
          <div className="billing-current__identity">
            <div className="billing-current__plan">{planName}</div>
            <div className="billing-current__meta">
              套餐代码 {subscription.plan_code.toUpperCase()} · 起始 {formatDate(subscription.start_date)} · 到期 {formatDate(subscription.end_date)}
            </div>
          </div>
          <span className={`billing-status billing-status--${tone}`}>
            {subscriptionStatusText(subscription.status)}
          </span>
        </div>

        <div className="billing-current__metrics">
          <SwissStat
            label="剩余核算"
            value={
              typeof remaining === 'number' ? formatNumber(remaining, 0) : '—'
            }
            unit={typeof remaining === 'number' ? '次' : undefined}
            tone={remainingTone}
          />
          <SwissStat
            label="核算用量"
            value={usageText(
              subscription.usage_calculations,
              subscription.quota_calculations,
              '次',
            )}
          />
          <SwissStat
            label="单据用量"
            value={usageText(subscription.usage_documents, subscription.quota_documents, '份')}
          />
        </div>

        <div className="billing-meters">
          <QuotaMeter
            label="核算用量"
            usage={subscription.usage_calculations}
            quota={subscription.quota_calculations}
            unit="次"
          />
          <QuotaMeter
            label="单据用量"
            usage={subscription.usage_documents}
            quota={subscription.quota_documents}
            unit="份"
          />
        </div>
      </div>
    </SwissSection>
  )
}
