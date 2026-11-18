import type { ReactNode } from 'react'
import type { SupplierSubmissionRecord } from '../../../api/types'
import { SwissTable, type SwissTableColumn } from '../../../components/swiss'
import { formatDateTime, formatNumber } from '../../../utils/format'
import './SubmissionsTable.css'

type SubmissionsTableProps = {
  submissions: SupplierSubmissionRecord[]
  empty?: ReactNode
}

const COLUMNS: SwissTableColumn[] = [
  { key: 'submission_id', title: '编号' },
  { key: 'period', title: '期间' },
  {
    key: 'reported_emissions',
    title: '排放量（kgCO₂e）',
    align: 'right',
    render: (row) => (
      <span className="num">{formatNumber(Number(row.reported_emissions), 2)}</span>
    ),
  },
  {
    key: 'reported_intensity',
    title: '排放强度（kgCO₂e/元）',
    align: 'right',
    render: (row) => (
      <span className="num">
        {formatNumber(
          typeof row.reported_intensity === 'number'
            ? row.reported_intensity
            : null,
          2,
        )}
      </span>
    ),
  },
  {
    key: 'note',
    title: '备注',
    render: (row) => (
      <span className="submission-note">{row.note ?? '—'}</span>
    ),
  },
  {
    key: 'created_at',
    title: '上报时间',
    align: 'right',
    render: (row) => (
      <span className="num">{formatDateTime(String(row.created_at ?? ''))}</span>
    ),
  },
]

/** 上报表：按后端返回顺序（最新在前）展示全部记录 */
export default function SubmissionsTable({
  submissions,
  empty,
}: SubmissionsTableProps) {
  const rows = submissions.map((item) => ({
    submission_id: item.submission_id,
    period: item.period,
    reported_emissions: item.reported_emissions,
    reported_intensity:
      typeof item.reported_intensity === 'number'
        ? item.reported_intensity
        : null,
    note: item.note?.trim() ? item.note : '—',
    created_at: item.created_at,
  }))

  return (
    <SwissTable
      columns={COLUMNS}
      rows={rows}
      rowKey={(row) => `submission-${String(row.submission_id)}`}
      empty={empty ?? '暂无上报记录'}
    />
  )
}
