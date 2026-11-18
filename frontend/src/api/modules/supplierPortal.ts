import { request } from '../client'
import type {
  SupplierPortalProfile,
  SupplierSubmissionPayload,
  SupplierSubmissionRecord,
  SupplierSubmissionResult,
} from '../types'

/** 仅 supplier 角色；返回档案、配额与减排计划 */
export function getMe() {
  return request<SupplierPortalProfile>({
    url: '/api/v1/supplier-portal/me',
    method: 'get',
  })
}

/** 填报当期碳数据；后端自动扣减当年配额 */
export function submitReport(payload: SupplierSubmissionPayload) {
  return request<SupplierSubmissionResult>({
    url: '/api/v1/supplier-portal/report',
    method: 'post',
    data: payload,
  })
}

export function listSubmissions() {
  return request<SupplierSubmissionRecord[]>({
    url: '/api/v1/supplier-portal/submissions',
    method: 'get',
  })
}
