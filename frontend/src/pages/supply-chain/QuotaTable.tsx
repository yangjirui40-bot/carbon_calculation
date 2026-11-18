import type { CarbonQuota, SupplierRecord } from '../../api/types'
import SwissTable, {
  type SwissTableColumn,
} from '../../components/swiss/SwissTable'
import { formatNumber } from '../../utils/format'
import './shared.css'

const COLUMNS: SwissTableColumn[] = [
  { key: 'supplier', title: '供应商' },
  { key: 'year', title: '年份', width: 84, align: 'right' },
  { key: 'allocated', title: '分配量', width: 132, align: 'right' },
  { key: 'used', title: '使用量', width: 132, align: 'right' },
  { key: 'remaining', title: '剩余量', width: 168, align: 'right' },
]

function supplierName(
  suppliers: SupplierRecord[],
  supplierId: string | null,
): string {
  if (supplierId === null) return '企业整体'
  return suppliers.find((item) => item.supplier_id === supplierId)?.name ?? supplierId
}

/** 配额表：数量单位 kgCO₂e；剩余量为负时标注超配额 */
export default function QuotaTable({
  quotas,
  suppliers,
}: {
  quotas: CarbonQuota[]
  suppliers: SupplierRecord[]
}) {
  const rows = quotas.map((quota) => ({
    _key: String(quota.id),
    supplier: (
      <span className="sc-cell-name">{supplierName(suppliers, quota.supplier_id)}</span>
    ),
    year: <span className="num">{quota.year}</span>,
    allocated: <span className="num">{formatNumber(quota.allocated_quota, 2)}</span>,
    used: <span className="num">{formatNumber(quota.used_quota, 2)}</span>,
    remaining:
      quota.remaining < 0 ? (
        <span className="sc-negative">
          <span className="num">{formatNumber(quota.remaining, 2)}</span> · 超配额
        </span>
      ) : (
        <span className="num">{formatNumber(quota.remaining, 2)}</span>
      ),
  }))

  return (
    <SwissTable
      columns={COLUMNS}
      rows={rows}
      rowKey={(row) => String(row._key)}
      empty="暂无配额记录"
    />
  )
}
