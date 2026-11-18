import type { DashboardSummary, Scope } from '../../../api/types'
import SwissSection from '../../../components/swiss/SwissSection'
import { formatEmission, formatPercent } from '../../../utils/format'
import './ScopeList.css'

type ScopeListProps = {
  summary: DashboardSummary
}

const ROWS: {
  scope: Scope
  no: string
  name: string
  detail: string
  color: string
}[] = [
  {
    scope: 'scope1',
    no: '01',
    name: 'Scope 1',
    detail: '直接排放 · 设备柴油等燃烧',
    color: 'var(--s1)',
  },
  {
    scope: 'scope2',
    no: '02',
    name: 'Scope 2',
    detail: '购入电力 · 间接排放',
    color: 'var(--s2)',
  },
  {
    scope: 'scope3',
    no: '03',
    name: 'Scope 3',
    detail: '采购商品与服务 · 价值链排放',
    color: 'var(--s3)',
  },
]

/** 占比只做展示除法，不产生新的核算口径 */
function displayRatio(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0
  return Math.min(Math.max(value / total, 0), 1)
}

export default function ScopeList({ summary }: ScopeListProps) {
  const total = summary.total_kgco2e

  return (
    <SwissSection
      kicker="Breakdown"
      title="Scope 拆分"
      extra="按本期已确认记录汇总 · kgCO₂e"
    >
      <div className="ws-scope-list">
        {ROWS.map((row) => {
          const value = summary.scope_breakdown[row.scope] ?? 0
          const ratio = displayRatio(value, total)
          return (
            <div className="ws-scope-row" key={row.scope}>
              <span className="ws-scope-no">{row.no}</span>
              <span className="ws-scope-name">
                {row.name}
                <small>{row.detail}</small>
              </span>
              <span className="ws-scope-bar" aria-hidden="true">
                <i style={{ width: `${ratio * 100}%`, background: row.color }} />
              </span>
              <span className="ws-scope-value">
                <strong>{formatEmission(value)}</strong>
                <em>{formatPercent(ratio)}</em>
              </span>
            </div>
          )
        })}
      </div>
    </SwissSection>
  )
}
