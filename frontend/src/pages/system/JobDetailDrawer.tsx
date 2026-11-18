import { useEffect, useState } from 'react'
import { systemApi } from '../../api'
import type { JobRecord } from '../../api/types'
import { SwissDrawer, SwissEmpty, SwissError } from '../../components/swiss'
import { formatDateTime, EMPTY_VALUE } from '../../utils/format'
import { toErrorMessage } from './errors'
import { jobStatusLabel, jobStatusTone, jobTypeLabel } from './labels'

type JobDetailDrawerProps = {
  jobId: number | null
  onClose: () => void
}

function isMissingJob(data: unknown): data is { job_id: number; found: false } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'found' in data &&
    (data as { found?: unknown }).found === false
  )
}

/** 任务详情：列表行只有摘要，打开抽屉时按 job_id 拉完整结果 */
export default function JobDetailDrawer({ jobId, onClose }: JobDetailDrawerProps) {
  const [detail, setDetail] = useState<JobRecord | null>(null)
  const [missing, setMissing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (jobId === null) {
      setDetail(null)
      setMissing(false)
      setError(null)
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    setError(null)
    setDetail(null)
    setMissing(false)
    systemApi
      .getJob(jobId)
      .then((data) => {
        if (!active) return
        if (isMissingJob(data)) {
          setMissing(true)
        } else {
          setDetail(data)
        }
        setLoading(false)
      })
      .catch((requestError: unknown) => {
        if (!active) return
        setError(toErrorMessage(requestError))
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [jobId, reloadKey])

  const open = jobId !== null
  const resultText =
    detail && detail.result !== undefined && detail.result !== null
      ? JSON.stringify(detail.result, null, 2)
      : null

  return (
    <SwissDrawer
      open={open}
      title={jobId === null ? '任务详情' : `任务 #${jobId}`}
      onClose={onClose}
      width={560}
    >
      {loading ? (
        <div className="system-state" role="status">
          正在加载任务详情…
        </div>
      ) : error ? (
        <SwissError message={error} onRetry={() => setReloadKey((key) => key + 1)} />
      ) : missing ? (
        <SwissEmpty title="任务不存在" description="后端没有找到这个任务编号。" />
      ) : detail ? (
        <div className="system-job-detail">
          <dl className="system-kv system-kv--compact">
            <div className="system-kv__row">
              <dt>任务编号</dt>
              <dd>{detail.job_id}</dd>
            </div>
            <div className="system-kv__row">
              <dt>任务类型</dt>
              <dd>{jobTypeLabel(detail.job_type)}</dd>
            </div>
            <div className="system-kv__row">
              <dt>状态</dt>
              <dd>
                <span className={`system-status system-status--${jobStatusTone(detail.status)}`}>
                  {jobStatusLabel(detail.status)}
                </span>
              </dd>
            </div>
            <div className="system-kv__row">
              <dt>尝试次数</dt>
              <dd>{detail.attempts ?? EMPTY_VALUE}</dd>
            </div>
            <div className="system-kv__row">
              <dt>开始时间</dt>
              <dd>{formatDateTime(detail.started_at)}</dd>
            </div>
            <div className="system-kv__row">
              <dt>结束时间</dt>
              <dd>{formatDateTime(detail.finished_at)}</dd>
            </div>
            <div className="system-kv__row">
              <dt>错误</dt>
              <dd className={detail.error ? 'is-fail' : undefined}>
                {detail.error ?? '无'}
              </dd>
            </div>
          </dl>

          <div className="system-job-result">
            <div className="system-job-result__head">返回结果</div>
            {resultText ? (
              <pre className="system-json">{resultText}</pre>
            ) : (
              <div className="system-state">该任务没有返回结果。</div>
            )}
          </div>
        </div>
      ) : null}
    </SwissDrawer>
  )
}
