import type { TradeReconciliation } from '../../api/types'
import SwissStat from '../../components/swiss/SwissStat'
import { formatAmount, formatNumber } from '../../utils/format'
import { QUOTA_UNIT } from './constants'
import './shared.css'
import './TradesPage.css'

function netTone(value: number): 'default' | 'accent' | 'fail' {
  if (value > 0) return 'accent'
  if (value < 0) return 'fail'
  return 'default'
}

/** 对账摘要：已成交交易的配额与资金汇总 */
export default function TradeSummary({
  summary,
}: {
  summary: TradeReconciliation['summary']
}) {
  return (
    <div className="sc-trade-summary">
      <SwissStat
        label="卖出总量"
        value={formatNumber(summary.sold_total, 2)}
        unit={QUOTA_UNIT}
      />
      <SwissStat
        label="买入总量"
        value={formatNumber(summary.bought_total, 2)}
        unit={QUOTA_UNIT}
      />
      <SwissStat
        label="净配额变动"
        value={formatNumber(summary.net_quota_change, 2)}
        unit={QUOTA_UNIT}
        tone={netTone(summary.net_quota_change)}
        hint="买入减卖出"
      />
      <SwissStat label="收入" value={formatAmount(summary.revenue)} />
      <SwissStat label="支出" value={formatAmount(summary.expense)} />
      <SwissStat
        label="净现金"
        value={formatAmount(summary.net_cash)}
        tone={netTone(summary.net_cash)}
        hint="收入减支出"
      />
    </div>
  )
}
