import { reportsApi } from '../../api'
import type { ReportFormat } from '../../api/types'

/** 下载报告 Blob → 临时 <a download> → 释放 object URL */
export async function saveReportFile(
  reportNo: string,
  format: ReportFormat,
): Promise<void> {
  const blob = await reportsApi.downloadReport(reportNo, format)
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = `${reportNo}.${format}`
  anchor.style.display = 'none'

  try {
    document.body.appendChild(anchor)
    anchor.click()
  } finally {
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 100)
  }
}
