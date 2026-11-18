import type { ReactNode } from 'react'
import type { SupplierPortalProfile } from '../../../api/types'
import { SwissTable, type SwissTableColumn } from '../../../components/swiss'
import { formatNumber } from '../../../utils/format'
import './QuotaTable.css'

type QuotaTableProps = {
  quotas: SupplierPortalProfile['quotas']
}

function numberCell(value: ReactNode): ReactNode {
  return <span className="num">{formatNumber(Number(value), 2)}</span>
}

const COLUMNS: SwissTableColumn[] = [
  { key: 'year', title: '年份' },
  {
    key: 'allocated',
    title: '分配量（kgCO₂e）',
    align: 'right',
    render: (row) => numberCell(row.allocated),
  },
  {
    key: 'used',
    title: '使用量（kgCO₂e）',
    align: 'right',
    render: (row) => numberCell(row.used),
  },
  {
    key: 'remaining',
    title: '剩余量（kgCO₂e）',
    align: 'right',
    render: (row) => {
      const value = Number(row.remaining)
      if (value < 0) {
        return (
          <span className="num quota-over">
            超配额 · {formatNumber(Math.abs(value), 2)}
          </span>
        )
      }
      return numberCell(row.remaining)
    },
  },
]

/** 配额表：剩余量为负时显示“超配额”并使用 fail 色 */
export default function QuotaTable({ quotas }: QuotaTableProps) {
  const rows = quotas.map((quota) => ({
    year: quota.year,
    allocated: quota.allocated,
    used: quota.used,
    remaining: quota.remaining,
  }))

  return (
    <SwissTable
      columns={COLUMNS}
      rows={rows}
      rowKey={(row) => `quota-${String(row.year)}`}
      empty="暂无配额记录"
    />
  )
}
