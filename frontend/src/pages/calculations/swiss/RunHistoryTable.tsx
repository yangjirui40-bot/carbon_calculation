import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { CalculationRunSummary } from '../../../api/types'
import { SwissEmpty, SwissError, SwissTable } from '../../../components/swiss'
import type { SwissTableColumn } from '../../../components/swiss'
import { formatDateTime, formatEmission } from '../../../utils/format'
import { operationLabel, runStatusLabel } from '../labels'
import './RunHistoryTable.css'

type RunHistoryTableProps = {
  runs: CalculationRunSummary[]
  loading: boolean
  error: string | null
  onRetry: () => void
}

const COLUMNS: SwissTableColumn[] = [
  { key: 'runId', title: '运行编号' },
  { key: 'operation', title: '类型' },
  { key: 'status', title: '状态' },
  { key: 'total', title: '总排放 (kgCO₂e)', align: 'right' },
  { key: 'createdAt', title: '创建时间' },
  { key: 'action', title: '操作', align: 'right' },
]

/** 运行历史：失败任务也保留，便于追溯。 */
export default function RunHistoryTable({
  runs,
  loading,
  error,
  onRetry,
}: RunHistoryTableProps) {
  if (loading) {
    return (
      <div className="calc-loading" role="status" aria-busy="true">
        正在加载运行历史…
      </div>
    )
  }

  if (error) {
    return <SwissError message={error} onRetry={onRetry} />
  }

  if (runs.length === 0) {
    return (
      <SwissEmpty
        title="还没有核算任务"
        description="发起一次企业核算后，运行记录会出现在这里。"
      />
    )
  }

  const rows = runs.map<Record<string, ReactNode>>((run) => ({
    id: run.run_id,
    runId: <span className="calc-code">{run.run_id}</span>,
    operation: operationLabel(run.operation),
    status: (
      <span
        className={
          run.status === 'success'
            ? 'calc-status calc-status--success'
            : 'calc-status calc-status--error'
        }
      >
        {runStatusLabel(run.status)}
      </span>
    ),
    total:
      run.total_kgco2e === null ? (
        '—'
      ) : (
        <span className="calc-num">{formatEmission(run.total_kgco2e)}</span>
      ),
    createdAt: <span className="calc-date">{formatDateTime(run.created_at)}</span>,
    action: (
      <Link className="calc-row-link" to={`/results/${run.run_id}`}>
        查看结果
      </Link>
    ),
  }))

  return (
    <SwissTable
      columns={COLUMNS}
      rows={rows}
      rowKey={(row) => String(row.id)}
      empty="暂无核算任务"
    />
  )
}
