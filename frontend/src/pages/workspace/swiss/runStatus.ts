import type { RunStatus } from '../../../api/types'

/** 核算运行状态的中文标签与视觉语义 */
const RUN_STATUS_LABEL: Record<RunStatus, string> = {
  success: '已完成',
  error: '失败',
}

export type RunStatusTone = 'ok' | 'fail' | 'neutral'

export function runStatusLabel(status: string): string {
  return RUN_STATUS_LABEL[status as RunStatus] ?? status
}

export function runStatusTone(status: string): RunStatusTone {
  if (status === 'success') return 'ok'
  if (status === 'error') return 'fail'
  return 'neutral'
}
