import { download, request } from '../client'
import type {
  ISO14064RequestPayload,
  PCFReportRequestPayload,
  ReportDetail,
  ReportFormat,
  ReportGenerationResponse,
  ReportSummary,
} from '../types'

export function listReports(params: { company_id?: number } = {}) {
  return request<ReportSummary[]>({
    url: '/api/v1/reports',
    method: 'get',
    params,
  })
}

export function getReport(reportNo: string) {
  return request<ReportDetail | { found: false }>({
    url: `/api/v1/reports/${reportNo}`,
    method: 'get',
  })
}

/** 生成并保存 ISO 14064-1 企业盘查清单 */
export function generateIso14064(payload: ISO14064RequestPayload) {
  return request<ReportGenerationResponse | { found: false }>({
    url: '/api/v1/reports/iso14064',
    method: 'post',
    data: payload,
  })
}

/** 生成并保存 ISO 14067 产品碳足迹报告 */
export function generatePcf(payload: PCFReportRequestPayload) {
  return request<ReportGenerationResponse | { found: false }>({
    url: '/api/v1/reports/pcf',
    method: 'post',
    data: payload,
  })
}

/** 下载报告：fmt = pdf | xml */
export function downloadReport(reportNo: string, fmt: ReportFormat = 'pdf') {
  return download({
    url: `/api/v1/reports/${reportNo}/download`,
    method: 'get',
    params: { fmt },
    timeout: 60_000,
  })
}
