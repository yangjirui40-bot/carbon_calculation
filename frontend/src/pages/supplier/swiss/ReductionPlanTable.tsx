import type { ReactNode } from 'react'
import type { SupplierPortalProfile } from '../../../api/types'
import { SwissTable, type SwissTableColumn } from '../../../components/swiss'
import { formatPercent } from '../../../utils/format'
import {
  formatDeadline,
  planStatusLabel,
  planStatusTone,
} from '../meta'
import './ReductionPlanTable.css'

type ReductionPlanTableProps = {
  plans: SupplierPortalProfile['reduction_plans']
}

function progressRatio(value: ReactNode): number {
  const ratio = Number(value)
  if (!Number.isFinite(ratio)) return 0
  return Math.min(Math.max(ratio, 0), 1)
}

function renderProgress(value: ReactNode): ReactNode {
  const ratio = progressRatio(value)
  return (
    <div
      className="plan-progress"
      role="img"
      aria-label={`进度 ${formatPercent(ratio)}`}
    >
      <span className="plan-progress__value num">{formatPercent(ratio)}</span>
      <span className="plan-progress__track">
        <span
          className="plan-progress__fill"
          style={{ width: `${ratio * 100}%` }}
        />
      </span>
    </div>
  )
}

const COLUMNS: SwissTableColumn[] = [
  { key: 'plan_id', title: '编号' },
  { key: 'title', title: '标题' },
  {
    key: 'target_rate',
    title: '目标减排率',
    align: 'right',
    render: (row) => (
      <span className="num">{formatPercent(Number(row.target_rate))}</span>
    ),
  },
  {
    key: 'progress',
    title: '进度',
    width: 160,
    render: (row) => renderProgress(row.progress),
  },
  {
    key: 'status',
    title: '状态',
    render: (row) => {
      const status = String(row.status)
      return (
        <span className={`plan-status plan-status--${planStatusTone(status)}`}>
          {planStatusLabel(status)}
        </span>
      )
    },
  },
  {
    key: 'deadline',
    title: '截止日期',
    align: 'right',
    render: (row) => (
      <span className="num">{formatDeadline(String(row.deadline ?? ''))}</span>
    ),
  },
]

/** 减排计划表：进度用 2px 细线，状态以文字 + 方形色点呈现 */
export default function ReductionPlanTable({ plans }: ReductionPlanTableProps) {
  const rows = plans.map((plan) => ({
    plan_id: plan.plan_id,
    title: plan.title,
    target_rate: plan.target_rate,
    progress: plan.progress,
    status: plan.status,
    deadline: plan.deadline ?? '',
  }))

  return (
    <SwissTable
      columns={COLUMNS}
      rows={rows}
      rowKey={(row) => `plan-${String(row.plan_id)}`}
      empty="暂无减排计划"
    />
  )
}
