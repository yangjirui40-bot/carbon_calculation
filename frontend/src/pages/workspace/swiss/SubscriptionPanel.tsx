import type { SubscriptionInfo } from '../../../api/types'
import SwissSection from '../../../components/swiss/SwissSection'
import { formatNumber } from '../../../utils/format'
import './SubscriptionPanel.css'

type SubscriptionPanelProps = {
  subscription: SubscriptionInfo
}

const STATUS_LABELS: Record<string, string> = {
  active: '有效',
  trial: '试用',
  expired: '已过期',
  canceled: '已取消',
}

function usageText(usage: number, quota: number | null | undefined): string {
  if (typeof quota !== 'number' || !Number.isFinite(quota)) {
    return `${formatNumber(usage, 0)} 次`
  }
  return `${formatNumber(usage, 0)} / ${formatNumber(quota, 0)}`
}

/** 订阅用量摘要；接口失败时整块不渲染 */
export default function SubscriptionPanel({ subscription }: SubscriptionPanelProps) {
  return (
    <SwissSection kicker="Plan" title="订阅用量" extra={subscription.plan_code.toUpperCase()}>
      <dl className="ws-sub">
        <div className="ws-sub__row">
          <dt>状态</dt>
          <dd>{STATUS_LABELS[subscription.status] ?? subscription.status}</dd>
        </div>
        <div className="ws-sub__row">
          <dt>核算用量</dt>
          <dd>
            {usageText(subscription.usage_calculations, subscription.quota_calculations)}
          </dd>
        </div>
        <div className="ws-sub__row">
          <dt>单据用量</dt>
          <dd>{usageText(subscription.usage_documents, subscription.quota_documents)}</dd>
        </div>
        <div className="ws-sub__row">
          <dt>剩余核算</dt>
          <dd>
            {typeof subscription.remaining_calculations === 'number'
              ? `${formatNumber(subscription.remaining_calculations, 0)} 次`
              : '—'}
          </dd>
        </div>
      </dl>
    </SwissSection>
  )
}
