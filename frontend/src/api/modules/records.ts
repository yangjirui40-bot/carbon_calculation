import { request } from '../client'
import type {
  BusinessRecord,
  RecordCreatePayload,
  RecordImportResult,
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
  })
}

export function deleteRecord(recordNo: string) {
  return request<void>({
    url: `/api/v1/records/${recordNo}`,
    method: 'delete',
  })
}
