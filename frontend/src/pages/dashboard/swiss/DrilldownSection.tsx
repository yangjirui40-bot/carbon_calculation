import { useState } from 'react'
import type { DashboardDrilldown } from '../../../api/types'
import SwissEmpty from '../../../components/swiss/SwissEmpty'
import SwissSection from '../../../components/swiss/SwissSection'
import SwissTable, { type SwissTableColumn } from '../../../components/swiss/SwissTable'
import SwissTabs, { type SwissTabItem } from '../../../components/swiss/SwissTabs'
import { formatEmission, formatNumber } from '../../../utils/format'
import { categoryLabel, scopeName } from './labels'

type DrilldownSectionProps = {
  drilldown: DashboardDrilldown
}

const SCOPE_ORDER = ['scope1', 'scope2', 'scope3']

function basisText(basis: number | null, unit: string): string {
  if (typeof basis !== 'number' || !Number.isFinite(basis)) return '—'
  return `${formatNumber(basis, 2)} ${unit}`
}

/** 下钻明细：按 Scope 切换，记录级表格 */
export default function DrilldownSection({ drilldown }: DrilldownSectionProps) {
  const [active, setActive] = useState('scope1')

  const orderedKeys = SCOPE_ORDER.filter((key) => Boolean(drilldown.scopes[key]))
  const extraKeys = Object.keys(drilldown.scopes).filter(
    (key) => !SCOPE_ORDER.includes(key),
  )
  const allKeys = [...orderedKeys, ...extraKeys]

  if (allKeys.length === 0) {
    return (
      <SwissSection kicker="Drilldown" title="下钻明细">
        <SwissEmpty
          title="暂无下钻数据"
          description="完成一次企业核算后，这里会按 Scope 列出记录级明细。"
        />
      </SwissSection>
    )
  }

  const activeKey = allKeys.includes(active) ? active : allKeys[0]
  const current = drilldown.scopes[activeKey]

  const tabs: SwissTabItem[] = allKeys.map((key) => ({
    key,
    label: scopeName(key),
    count: drilldown.scopes[key]?.items.length ?? 0,
  }))

  const hasPeriod = current.items.some((item) => Boolean(item.period))

  const columns: SwissTableColumn[] = [
    { key: 'record_no', title: '记录编号', width: 150 },
    { key: 'category', title: '类别' },
    { key: 'basis', title: '活动量 / 金额', align: 'right' },
    { key: 'factor_id', title: '因子', width: 150 },
    { key: 'emissions', title: '排放 (kgCO₂e)', align: 'right', width: 130 },
  ]

  if (hasPeriod) {
    columns.splice(1, 0, { key: 'period', title: '期间', width: 100 })
  }

  const rows = current.items.map((item, index) => ({
    key: `${item.record_no}-${index}`,
    record_no: item.record_no,
    period: item.period ?? '—',
    category: categoryLabel(item.category),
    basis: <span className="num">{basisText(item.basis, item.unit)}</span>,
    factor_id: item.factor_id,
    emissions: (
      <span className="num">{formatEmission(item.emissions_kgco2e)}</span>
    ),
  }))

  return (
    <SwissSection kicker="Drilldown" title="下钻明细" extra="按 Scope 切换 · kgCO₂e">
      <SwissTabs items={tabs} activeKey={activeKey} onChange={setActive} />

      <div
        className="dash-drilldown"
        role="tabpanel"
        aria-label={`${scopeName(activeKey)} 下钻明细`}
      >
        <p className="dash-card__note dash-drilldown__summary">
          {scopeName(activeKey)} 合计 {formatEmission(current.total_kgco2e)} kgCO₂e，共{' '}
          {current.items.length} 条记录。
        </p>

        <div role="group" aria-label={`${scopeName(activeKey)} 明细数据表`}>
          <SwissTable
            columns={columns}
            rows={rows}
            rowKey={(row) => String(row.key)}
            empty="该 Scope 暂无记录"
          />
        </div>
      </div>
    </SwissSection>
  )
}
