import type { SupplierPortalProfile } from '../../../api/types'
import { SwissStat } from '../../../components/swiss'
import { formatNumber } from '../../../utils/format'
import './CurrentQuotaPanel.css'

type CurrentQuotaPanelProps = {
  quota: SupplierPortalProfile['quotas'][number]
}

/** 当前配额：只展示门户实时余额，不推导历史配额 */
export default function CurrentQuotaPanel({ quota }: CurrentQuotaPanelProps) {
  const remainingIsNegative = quota.remaining < 0

  return (
    <div className="current-quota">
      <div className="current-quota__stats">
        <SwissStat
          label="年度分配量"
          value={formatNumber(quota.allocated, 2)}
          unit="kgCO₂e"
        />
        <SwissStat
          label="已使用"
          value={formatNumber(quota.used, 2)}
          unit="kgCO₂e"
        />
        <SwissStat
          label="当前剩余"
          value={
            remainingIsNegative
              ? `超配额 ${formatNumber(Math.abs(quota.remaining), 2)}`
              : formatNumber(quota.remaining, 2)
          }
          unit="kgCO₂e"
          tone={remainingIsNegative ? 'fail' : 'accent'}
        />
      </div>
      <p className="current-quota__note">
        当前配额为门户实时余额，仅对应 {quota.year} 年度；页面不提供历史配额变化。
      </p>
    </div>
  )
}
