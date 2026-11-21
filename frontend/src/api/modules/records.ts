import { request } from '../client'
import type {
  BusinessRecord,
  RecordCreatePayload,
  RecordImportResult,
  RecordClassification,
} from '../types'

export interface RecordListParams {
  company_id?: number
  period?: string
}

export function listRecords(params: RecordListParams = {}) {
  return request<BusinessRecord[]>({
    url: '/api/v1/records',
    method: 'get',
    params,
  })
}

export function createRecord(payload: RecordCreatePayload) {
  return request<BusinessRecord>({
    url: '/api/v1/records',
    method: 'post',
    data: payload,
  })
}

/** 批量导入 CSV/XLSX；company_id 走 query */
export function importRecords(file: File, companyId: number) {
  const form = new FormData()
  form.append('file', file)
  return request<RecordImportResult>({
    url: '/api/v1/records/import',
    method: 'post',
    params: { company_id: companyId },
    data: form,
    timeout: 120_000,
  })
}

export function deleteRecord(recordNo: string) {
  return request<void>({
    url: `/api/v1/records/${recordNo}`,
    method: 'delete',
  })
}

export interface RecordsPageParams extends RecordListParams {
  page: number
  size: number
  category?: string
  scope?: string
  review_status?: string; site_id?: number
}

export function pageRecords(params: RecordsPageParams) {
  return request<{ records: BusinessRecord[]; periods: string[]; total: number; page: number }>({
    url: '/api/v1/records/page', method: 'get', params,
  })
}

export function classifyRecord(recordNo: string, payload: RecordClassification) {
  return request<BusinessRecord>({
    url: `/api/v1/records/${encodeURIComponent(recordNo)}/classification`, method: 'put', data: payload,
  })
}

export function confirmRecord(recordNo: string) {
  return request<BusinessRecord>({
    url: `/api/v1/records/${encodeURIComponent(recordNo)}/confirm`, method: 'post',
  })
}
