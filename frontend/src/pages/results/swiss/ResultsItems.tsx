import type { ReactNode } from 'react'
import { SwissTable } from '../../../components/swiss'
import type { SwissTableColumn } from '../../../components/swiss'
import { CATEGORY_LABELS } from '../../../config/business'
import { formatEmission, formatNumber } from '../../../utils/format'
import type { EnterpriseResultItem } from '../enterpriseResult'
import { scopeLabel } from '../text'
import './ResultsItems.css'

type ResultsItemsProps = {
  items: EnterpriseResultItem[]
}

const COLUMNS: SwissTableColumn[] = [
  { key: 'recordId', title: '记录编号' },
  { key: 'category', title: '类别' },
  { key: 'scope', title: 'Scope' },
  { key: 'activity', title: '活动量 / 金额', align: 'right' },
  { key: 'factor', title: '因子' },
  { key: 'emissions', title: '排放量 (kgCO₂e)', align: 'right' },
]

function categoryLabel(category: string): string {
  if (!category) return '—'
  return (CATEGORY_LABELS as Record<string, string>)[category] ?? category
}

function activityText(item: EnterpriseResultItem): string {
  if (item.amount === null) return '—'
  if (!item.unit) return formatNumber(item.amount, 2)
  if (item.unit === 'CNY') return `${formatNumber(item.amount, 2)} 元`
  return `${formatNumber(item.amount, 2)} ${item.unit}`
}

/** 企业核算明细：一行对应一条已确认记录，排放量直接取后端返回值。 */
export default function ResultsItems({ items }: ResultsItemsProps) {
  const rows = items.map<Record<string, ReactNode>>((item, index) => ({
    id: `${item.recordId || 'row'}-${index}`,
    recordId: <span className="results-mono">{item.recordId || '—'}</span>,
    category: categoryLabel(item.category),
    scope: scopeLabel(item.scope),
    activity: <span className="results-num">{activityText(item)}</span>,
    factor: (
      <span className="results-factor-cell">
        <span className="results-mono">{item.factorId || '—'}</span>
        {item.factorVersion ? (
          <span className="results-factor-version">· {item.factorVersion}</span>
        ) : null}
      </span>
    ),
    emissions: (
      <span className="results-num">{formatEmission(item.emissions)}</span>
    ),
  }))

  return (
    <SwissTable
      columns={COLUMNS}
      rows={rows}
      rowKey={(row) => String(row.id)}
      empty="本次核算没有明细记录"
    />
  )
}
