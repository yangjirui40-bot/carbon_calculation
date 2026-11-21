import { Link } from 'react-router-dom'
import { useState } from 'react'
import type { DashboardDrilldown } from '../../../api/types'
import SwissEmpty from '../../../components/swiss/SwissEmpty'
import SwissSection from '../../../components/swiss/SwissSection'
import SwissTable, { type SwissTableColumn } from '../../../components/swiss/SwissTable'
import SwissTabs, { type SwissTabItem } from '../../../components/swiss/SwissTabs'
import { formatEmission, formatNumber } from '../../../utils/format'
import { categoryLabel, scopeName } from './labels'

import { locationLabel, locationKey } from '../monitor'

type DrilldownSectionProps = {
  drilldown: DashboardDrilldown
  organization?: string
  scope?: string
  category?: string
  runId?: string | null
}

const SCOPE_ORDER = ['scope1', 'scope2', 'scope3']

function basisText(basis: number | null, unit: string): string {
  if (typeof basis !== 'number' || !Number.isFinite(basis)) return '—'
  return `${formatNumber(basis, 2)} ${unit}`
}

/** 下钻明细：按 Scope 切换，记录级表格 */
export default function DrilldownSection({ drilldown, scope, category, runId, organization }: DrilldownSectionProps) {
  const [selectedCategory, setCategory] = useState(category ?? '')
  const [active, setActive] = useState(scope ?? 'scope1')
  const [selectedOrganization, setOrganization] = useState(organization ?? '')
  const [offset, setOffset] = useState(0)

  const orderedKeys = SCOPE_ORDER.filter((key) => Boolean(drilldown.scopes[key]) || key === scope)
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
  const current = drilldown.scopes[activeKey] ?? { items: [], total_kgco2e: 0 }

  const tabs: SwissTabItem[] = allKeys.map((key) => ({
    key,
    label: scopeName(key),
    count: drilldown.scopes[key]?.items.length ?? 0,
  }))

  const categories = [...new Set(current.items.map((item) => item.category))]
  const organizations = new Map(current.items.map(item => [locationKey(item), locationLabel(item)]))
  const items = current.items.filter((item) =>
    (!selectedCategory || item.category === selectedCategory) &&
    (!selectedOrganization || locationKey(item) === selectedOrganization)
  )
  const total = items.reduce((sum, item) => sum + item.emissions_kgco2e, 0)
  const hasPeriod = current.items.some((item) => Boolean(item.period))

  const columns: SwissTableColumn[] = [
    { key: 'record_no', title: '记录编号', width: 150 },
    { key: 'category', title: '类别' },
    { key: 'location', title: '车间 / 产线' },
    { key: 'basis', title: '活动量 / 金额', align: 'right' },
    { key: 'factor_id', title: '因子', width: 150 },
    { key: 'emissions', title: '排放 (kgCO₂e)', align: 'right', width: 130 },
  ]

  if (hasPeriod) {
    columns.splice(1, 0, { key: 'period', title: '期间', width: 100 })
  }

  const rows = items.slice(offset, offset + 50).map((item, index) => ({
    key: `${item.record_no}-${index}`,
    record_no: runId ? <Link to={`/audit/runs/${runId}?record=${encodeURIComponent(item.record_no)}`}>{item.record_no}</Link> : item.record_no,
    period: item.period ?? '—',
    category: categoryLabel(item.category),
    location: locationLabel(item),
    basis: <span className="num">{basisText(item.basis, item.unit)}</span>,
    factor_id: item.factor_id,
    emissions: (
      <span className="num">{formatEmission(item.emissions_kgco2e)}</span>
    ),
  }))

  return (
    <SwissSection kicker="Drilldown" title="下钻明细" extra="按 Scope 切换 · kgCO₂e">
      <SwissTabs items={tabs} activeKey={activeKey} onChange={(key) => { setActive(key); setCategory(''); setOrganization(''); setOffset(0) }} />

      <div
        className="dash-drilldown"
        role="tabpanel"
        aria-label={`${scopeName(activeKey)} 下钻明细`}
      >
        <label className="dash-category">业务类别
          <select value={selectedCategory} onChange={(event) => { setCategory(event.target.value); setOffset(0) }}>
            <option value="">全部</option>
            {categories.map((item) => <option value={item} key={item}>{categoryLabel(item)}</option>)}
          </select>
        </label>
        <label className="dash-category">车间 / 产线
          <select value={selectedOrganization} onChange={(event) => { setOrganization(event.target.value); setOffset(0) }}>
            <option value="">全部</option>
            {Array.from(organizations, ([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <p className="dash-card__note dash-drilldown__summary">
          {scopeName(activeKey)} 合计 {formatEmission(total)} kgCO₂e，共{' '}
          {items.length} 条记录。
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
        {items.length > 50 && <div className="dash-context" aria-label="核算明细分页">
          <button type="button" disabled={offset === 0} onClick={() => setOffset(offset - 50)}>上一页</button>
          <span>{Math.floor(offset / 50) + 1} / {Math.ceil(items.length / 50)} 页</span>
          <button type="button" disabled={offset + 50 >= items.length} onClick={() => setOffset(offset + 50)}>下一页</button>
        </div>}
    </SwissSection>
  )
}
