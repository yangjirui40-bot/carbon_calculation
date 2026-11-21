import type { ReactNode } from 'react'
import type { ProductBomLine } from '../../../api/types'
import { SwissTable } from '../../../components/swiss'
import type { SwissTableColumn } from '../../../components/swiss'
import { formatAmount } from '../../../utils/format'
import { categoryLabel, formatConfidence } from '../labels'
import './BomTable.css'

type BomTableProps = {
  items: ProductBomLine[]
  onSelect?: (item: ProductBomLine) => void
}

const COLUMNS: SwissTableColumn[] = [
  { key: 'itemId', title: '物料编号' },
  { key: 'material', title: '物料名称' },
  { key: 'amount', title: '金额', align: 'right' },
  { key: 'currency', title: '币种' },
  { key: 'category', title: '匹配类别' },
  { key: 'factor', title: '排放因子' },
  { key: 'confidence', title: '置信度', align: 'right' },
]

/** BOM 明细：匹配类别 / 因子 / 置信度由 SBERT 匹配回写。 */
export default function BomTable({ items, onSelect }: BomTableProps) {
  if (items.length === 0) {
    return (
      <div className="bom-table__empty" role="status">
        尚未导入 BOM。可导入物料后执行 SBERT 匹配与 PCF 核算。
      </div>
    )
  }

  const columns = onSelect ? [...COLUMNS, { key: 'action', title: '复核' }] : COLUMNS
  const rows = items.map<Record<string, ReactNode>>((item) => ({
    id: item.bom_item_id,
    itemId: <span className="bom-code">{item.bom_item_id}</span>,
    material: <>{item.material_name}{item.assembly_path && <><br /><small>{item.assembly_path}</small></>}</>,
    amount: <span className="bom-num">{formatAmount(item.material_amount)}</span>,
    currency: item.currency || 'CNY',
    category: item.matched_category ? (
      categoryLabel(item.matched_category)
    ) : (
      <span className="bom-unmatched">未匹配</span>
    ),
    factor: item.matched_factor_id ? (
      <span className="bom-code">{item.matched_factor_id}</span>
    ) : (
      '—'
    ),
    confidence: item.match_confidence === null ? (item.matched_factor_id ? '已指定' : '—') : formatConfidence(item.match_confidence),
    action: onSelect ? <button className="bom-factor-edit" type="button" onClick={() => onSelect(item)} aria-label={`复核 ${item.material_name} 因子`}>复核因子</button> : null,
  }))

  return <SwissTable columns={columns} rows={rows} rowKey={(row) => String(row.id)} empty="暂无 BOM" />
}
