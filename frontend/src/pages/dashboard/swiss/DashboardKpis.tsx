import type { DashboardRing, DashboardSummary, Scope } from '../../../api/types'
import SwissStat from '../../../components/swiss/SwissStat'
import { formatEmission, formatNumber, formatPercent } from '../../../utils/format'

type DashboardKpisProps = {
  summary: DashboardSummary
  ring: DashboardRing
}

const SCOPES: { scope: Scope; label: string }[] = [
  { scope: 'scope1', label: 'Scope 1 直接排放' },
  { scope: 'scope2', label: 'Scope 2 间接排放' },
  { scope: 'scope3', label: 'Scope 3 价值链排放' },
]

export default function DashboardKpis({ summary, ring }: DashboardKpisProps) {
  const ratioByScope = new Map(ring.scopes.map((item) => [item.scope, item.ratio]))

  return (
    <section className="dash-kpis" aria-label="总览指标">
      <div className="dash-kpi">
        <SwissStat
          label="总排放"
          value={formatEmission(summary.run_id ? summary.total_kgco2e : null)}
          unit="kgCO₂e"
          hint={`${summary.run_id ? formatNumber(summary.total_kgco2e / 1000, 2) + ' tCO₂e' : '等待首次核算'}`}
        />
      </div>
      {SCOPES.map((item) => {
        const ratio = ratioByScope.get(item.scope)
        return (
          <div className="dash-kpi" key={item.scope}>
            <SwissStat
              label={item.label}
              value={formatEmission(summary.run_id ? summary.scope_breakdown[item.scope] : null)}
              unit="kgCO₂e"
              hint={typeof ratio === 'number' ? `占本期 ${formatPercent(ratio)}` : '—'}
            />
          </div>
        )
      })}
    </section>
  )
}
