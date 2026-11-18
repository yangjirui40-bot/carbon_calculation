export type StatusTone = 'accent' | 'warn' | 'fail' | 'muted'

const JOB_STATUS_LABELS: Record<string, string> = {
  pending: '排队中',
  queued: '排队中',
  running: '运行中',
  processing: '运行中',
  success: '成功',
  succeeded: '成功',
  failed: '失败',
  error: '失败',
}

export function jobStatusLabel(status: string): string {
  return JOB_STATUS_LABELS[status.toLowerCase()] ?? status
}

export function jobStatusTone(status: string): StatusTone {
  const normalized = status.toLowerCase()
  if (normalized === 'success' || normalized === 'succeeded') return 'accent'
  if (normalized === 'running' || normalized === 'processing' || normalized === 'pending' || normalized === 'queued') {
    return 'warn'
  }
  if (normalized === 'failed' || normalized === 'error') return 'fail'
  return 'muted'
}

const JOB_TYPE_LABELS: Record<string, string> = {
  document_parse: '单据解析',
  product_match: '产品物料匹配',
  report_generate: '报告生成',
  olap_refresh: 'OLAP 重建',
}

export function jobTypeLabel(type: string): string {
  return JOB_TYPE_LABELS[type] ?? type
}

export function healthStatusLabel(status: string): string {
  if (status === 'healthy') return '正常'
  if (status === 'degraded') return '降级'
  if (status === 'down') return '不可用'
  return status
}

export function healthStatusTone(status: string): StatusTone {
  if (status === 'healthy') return 'accent'
  if (status === 'degraded') return 'warn'
  return 'fail'
}
