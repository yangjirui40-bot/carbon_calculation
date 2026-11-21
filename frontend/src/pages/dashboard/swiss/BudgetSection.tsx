import { useState } from 'react'
import { dashboardApi } from '../../../api'
import type { DashboardBudget } from '../../../api/types'
import { SwissButton, SwissInput, SwissSection } from '../../../components/swiss'
import { formatNumber } from '../../../utils/format'

const statusLabels = { unset: '未设置', over: '已超出累计预算', within: '在累计预算内', incomplete: '月度数据待补齐' }

export default function BudgetSection({ budget, companyId, canWrite, onSaved }: {
  budget: DashboardBudget; companyId: number; canWrite: boolean; onSaved: () => void
}) {
  const [value, setValue] = useState(budget.annual_limit_kgco2e == null ? '' : (budget.annual_limit_kgco2e / 1000).toString())
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  return <SwissSection title={`${budget.year} 年排放预算`} extra={statusLabels[budget.status]}>
    <div className="dash-budget-summary">
      <div><span>已核算排放</span><b>{formatNumber(budget.actual_kgco2e / 1000)} tCO₂e</b></div>
      <div><span>截至最近核算月份的预算</span><b>{budget.allocated_kgco2e == null ? '—' : `${formatNumber(budget.allocated_kgco2e / 1000)} tCO₂e`}</b></div>
      <div><span>核算月份覆盖</span><b>{budget.covered_months} / {budget.elapsed_months || '—'}</b></div>
    </div>
    <p className="dash-card__note">按当年各月最新成功快照汇总。年度预算按月等分，缺失月份待补齐。</p>
    {canWrite && <form className="dash-budget-form" onSubmit={async (event) => {
      event.preventDefault()
      setBusy(true)
      setMessage('')
      try {
        await dashboardApi.saveBudget(companyId, budget.year, Number(value) * 1000)
        onSaved()
      } catch {
        setMessage('预算保存失败，请检查输入和权限。')
      } finally {
        setBusy(false)
      }
    }}>
      <label htmlFor="annual-budget">年度预算（tCO₂e）</label>
      <SwissInput id="annual-budget" type="number" min="0.001" max="1000000000000" step="any" required
        value={value} onChange={(event) => setValue(event.target.value)} />
      <SwissButton type="submit" loading={busy}>保存预算</SwissButton>
      {message && <span role="alert">{message}</span>}
    </form>}
  </SwissSection>
}
