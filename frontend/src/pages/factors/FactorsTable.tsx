import type { ReactNode } from 'react'
import { SwissTable, type SwissTableColumn } from '../../components/swiss'
import type { FactorRecord } from '../../api/types'
import { formatNumber, formatPercent } from '../../utils/format'
import {
  caliberLabel,
  categoryLabel,
  displayOrigin,
  scopeLabel,
} from './constants'

type FactorsTableProps = {
  factors: FactorRecord[]
  emptyText: string
}

const COLUMNS: SwissTableColumn[] = [
  { key: 'factor_id', title: '因子编号' },
  { key: 'category', title: '类别' },
  { key: 'scope', title: 'Scope' },
  { key: 'value', title: '数值', align: 'right' },
  { key: 'unit', title: '单位' },
  { key: 'version', title: '版本' },
  { key: 'origin', title: '来源' },
  { key: 'caliber', title: '口径' },
  { key: 'uncertainty', title: '不确定性', align: 'right' },
]

/** 因子列表：来源在单元格内截断，完整文本放在 title 中 */
export default function FactorsTable({ factors, emptyText }: FactorsTableProps) {
  const rows: Array<Record<string, ReactNode>> = factors.map((factor) => {
    const origin = displayOrigin(factor.origin, factor.is_demo)
    return {
      key: factor.factor_id,
      factor_id: factor.factor_id,
      category: categoryLabel(factor.category),
      scope: scopeLabel(factor.scope),
      value: <span className="factors-number">{formatNumber(factor.value, 6)}</span>,
      unit: factor.unit,
      version: factor.version,
      origin: (
        <span className="factors-origin" title={origin}>
          {origin}
        </span>
      ),
      caliber: (
        <span
          className={
            factor.is_demo
              ? 'factors-caliber factors-caliber--project'
              : 'factors-caliber factors-caliber--official'
          }
        >
          {factor.version.startsWith('research-') ? '研究推导（CO₂）' : caliberLabel(factor.is_demo)}
        </span>
      ),
      uncertainty: (
        <span className="factors-number">
          {factor.uncertainty_pct == null
            ? '—'
            : formatPercent(factor.uncertainty_pct / 100)}
        </span>
      ),
    }
  })

  return (
    <SwissTable
      columns={COLUMNS}
      rows={rows}
      rowKey={(row) => String(row.key)}
      empty={emptyText}
    />
  )
}
