/** 审计日志导出：后端返回 JSON 响应体 {logs}，前端构造 Blob 下载。 */

import dayjs from 'dayjs'
import type { AuditLogEntry } from '../../api/types'

/** 下载 audit-log-YYYYMMDD.json，返回实际文件名供提示 */
export function downloadAuditLogJson(logs: AuditLogEntry[]): string {
  const fileName = `audit-log-${dayjs().format('YYYYMMDD')}.json`
  const blob = new Blob([JSON.stringify({ logs }, null, 2)], {
    type: 'application/json;charset=utf-8',
  })
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = fileName
  anchor.style.display = 'none'

  try {
    document.body.appendChild(anchor)
    anchor.click()
  } finally {
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 100)
  }

  return fileName
}
