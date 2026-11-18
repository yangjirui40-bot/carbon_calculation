import type { ReactNode } from 'react'
import type { SwissTableColumn } from '../../components/swiss'
import { formatNumber } from '../../utils/format'

export const DERIVED_COLUMNS: SwissTableColumn[] = [
  { key: 'factor_id', title: '因子编号' },
  { key: 'sector', title: '部门' },
  { key: 'value', title: 'kgCO2e/CNY', align: 'right' },
]

/** 由 IO 表派生接口返回的原始记录转成表格行（响应无强类型） */
export function toDerivedRows(
  items: Array<Record<string, unknown>>,
): Array<Record<string, ReactNode>> {
  return items.map((item, index) => {
    const factorId =
      typeof item.factor_id === 'string' ? item.factor_id : `派生因子 ${index + 1}`
    const sector = typeof item.sector === 'string' && item.sector ? item.sector : '—'
    const value =
      typeof item.f_kgco2e_per_cny === 'number' ? (
        <span className="factors-number">{formatNumber(item.f_kgco2e_per_cny, 8)}</span>
      ) : (
        '—'
      )
    return { key: factorId, factor_id: factorId, sector, value }
  })
}
