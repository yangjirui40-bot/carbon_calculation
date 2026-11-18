import { useCallback, useEffect, useState } from 'react'
import { systemApi } from '../../api'
import type { JobRecord } from '../../api/types'
import {
  SwissButton,
  SwissEmpty,
  SwissError,
  SwissSection,
  SwissTable,
  type SwissTableColumn,
} from '../../components/swiss'
import { EMPTY_VALUE, formatDateTime } from '../../utils/format'
import { toErrorMessage } from './errors'
import JobDetailDrawer from './JobDetailDrawer'
import { jobStatusLabel, jobStatusTone, jobTypeLabel } from './labels'

const COLUMNS: SwissTableColumn[] = [
  { key: 'job_id', title: '任务 ID', width: 90 },
  { key: 'job_type', title: '类型', width: 120 },
  { key: 'status', title: '状态', width: 100 },
  { key: 'error', title: '错误' },
  { key: 'created_at', title: '创建时间', width: 140 },
  { key: 'actions', title: '操作', width: 84, align: 'right' },
]

/** 任务队列：最近 100 个任务；行内打开详情抽屉看完整结果 */
export default function JobsPanel() {
  const [jobs, setJobs] = useState<JobRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    systemApi
      .listJobs()
      .then((list) => {
        if (!active) return
        setJobs(list)
        setLoading(false)
      })
      .catch((requestError: unknown) => {
        if (!active) return
        setJobs([])
        setError(toErrorMessage(requestError))
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [reloadKey])

  const reload = useCallback(() => setReloadKey((key) => key + 1), [])

  const rows = jobs.map((job) => ({
    job_id: job.job_id,
    job_type: jobTypeLabel(job.job_type),
    status: (
      <span className={`system-status system-status--${jobStatusTone(job.status)}`}>
        {jobStatusLabel(job.status)}
      </span>
    ),
    error: job.error ?? EMPTY_VALUE,
    created_at: formatDateTime(job.created_at),
    actions: (
      <SwissButton
        variant="ghost"
        className="system-row-btn"
        aria-label={`查看任务 ${job.job_id} 详情`}
        onClick={() => setSelectedId(job.job_id)}
      >
        详情
      </SwissButton>
    ),
  }))

  return (
    <>
      <SwissSection
        kicker="Queue"
        title="任务队列"
        extra={loading ? '正在加载…' : `${jobs.length} 个任务`}
      >
        {error ? (
          <SwissError message={error} onRetry={reload} />
        ) : loading && jobs.length === 0 ? (
          <div className="system-state" role="status">
            正在加载任务…
          </div>
        ) : jobs.length === 0 ? (
          <SwissEmpty title="暂无任务" description="后端任务队列当前为空。" />
        ) : (
          <SwissTable
            columns={COLUMNS}
            rows={rows}
            rowKey={(row) => String(row.job_id)}
            empty="暂无任务"
          />
        )}
      </SwissSection>

      <JobDetailDrawer jobId={selectedId} onClose={() => setSelectedId(null)} />
    </>
  )
}
