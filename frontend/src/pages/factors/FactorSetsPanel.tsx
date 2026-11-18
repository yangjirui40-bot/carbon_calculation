import type { ReactNode } from 'react'
import { SwissEmpty, SwissError, SwissTable, type SwissTableColumn } from '../../components/swiss'
import type { FactorSetsResponse } from '../../api/types'
import { formatNumber, formatPercent } from '../../utils/format'
import { categoryLabel, displayOrigin } from './constants'

type FactorSetsPanelProps = {
  data: FactorSetsResponse | null
  loading: boolean
  error: string | null
  onRetry: () => void
}

const SET_COLUMNS: SwissTableColumn[] = [
  { key: 'category', title: '业务类别' },
  { key: 'factor_id', title: '因子编号' },
]

const OFFICIAL_COLUMNS: SwissTableColumn[] = [
  { key: 'factor_id', title: '因子编号' },
  { key: 'category', title: '类别' },
  { key: 'value', title: '数值', align: 'right' },
  { key: 'unit', title: '单位' },
  { key: 'origin', title: '来源' },
  { key: 'uncertainty', title: '不确定性', align: 'right' },
]

/** 因子集页签：每个因子集的类别→因子编号映射、官方因子清单与口径说明 */
export default function FactorSetsPanel({
  data,
  loading,
  error,
  onRetry,
}: FactorSetsPanelProps) {
  if (error) {
    return <SwissError message={error} onRetry={onRetry} />
  }

  if (loading && !data) {
    return (
      <div className="factors-state" role="status">
        正在加载因子集…
      </div>
    )
  }

  if (!data) return null

  const setNames = Object.keys(data.sets)
  const hasSets = setNames.length > 0
  const hasOfficial = data.official_factors.length > 0

  if (!hasSets && !hasOfficial) {
    return <SwissEmpty title="暂无因子集" description="因子集由后端内置，当前没有可展示的集合。" />
  }

  const officialRows: Array<Record<string, ReactNode>> = data.official_factors.map(
    (factor) => {
      const origin = displayOrigin(factor.origin, false)
      return {
        key: factor.factor_id,
        factor_id: factor.factor_id,
        category: categoryLabel(factor.category),
        value: <span className="factors-number">{formatNumber(factor.value, 6)}</span>,
        unit: factor.unit,
        origin: (
          <span className="factors-origin" title={origin}>
            {origin}
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
    },
  )

  return (
    <div className="factors-sets">
      {data.note ? <p className="factors-note">{data.note}</p> : null}

      {setNames.map((name) => {
        const mapping = data.sets[name]
        const rows: Array<Record<string, ReactNode>> = Object.entries(mapping).map(
          ([category, factorId]) => ({
            key: category,
            category: categoryLabel(category),
            factor_id: factorId,
          }),
        )
        return (
          <section className="factors-set" key={name}>
            <header className="factors-set__head">
              <h3 className="factors-set__title">{name}</h3>
              <span className="factors-set__meta">{rows.length} 个类别</span>
            </header>
            <SwissTable
              columns={SET_COLUMNS}
              rows={rows}
              rowKey={(row) => String(row.key)}
              empty="该因子集暂无类别映射"
            />
          </section>
        )
      })}

      {hasOfficial ? (
        <section className="factors-set">
          <header className="factors-set__head">
            <h3 className="factors-set__title">官方因子</h3>
            <span className="factors-set__meta">{officialRows.length} 条</span>
          </header>
          <SwissTable
            columns={OFFICIAL_COLUMNS}
            rows={officialRows}
            rowKey={(row) => String(row.key)}
            empty="暂无官方因子"
          />
        </section>
      ) : null}
    </div>
  )
}
