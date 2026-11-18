import { request } from '../client'
import type { AIStatusResponse, JobRecord, SchemaInfoResponse } from '../types'

/** AI 引擎就绪状态（OCR / LayoutLMv3 / SER / SBERT / LLM） */
export function getAiStatus() {
  return request<AIStatusResponse>({
    url: '/api/v1/system/ai-status',
    method: 'get',
  })
}

export function getJob(jobId: number) {
  return request<JobRecord | { job_id: number; found: false }>({
    url: `/api/v1/system/jobs/${jobId}`,
    method: 'get',
  })
}

/** 仅 admin / auditor */
export function listJobs() {
  return request<JobRecord[]>({
    url: '/api/v1/system/jobs',
    method: 'get',
  })
}

/** 仅管理员：重建 OLAP 星型模型 */
export function refreshOlap() {
  return request<Record<string, unknown>>({
    url: '/api/v1/system/olap/refresh',
    method: 'post',
  })
}

/** 数据建模说明（OLTP 3NF + OLAP 星型） */
export function getSchemaInfo() {
  return request<SchemaInfoResponse>({
    url: '/api/v1/system/schema',
    method: 'get',
  })
}
