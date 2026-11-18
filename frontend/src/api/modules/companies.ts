import { request } from '../client'
import type {
  CompanyCreatePayload,
  CompanyDetail,
  CompanyUpdatePayload,
} from '../types'

/** 企业用户只返回本企业；admin/auditor 返回全部 */
export function listCompanies() {
  return request<CompanyDetail[]>({
    url: '/api/v1/companies',
    method: 'get',
  })
}

export function getCompany(companyId: number) {
  return request<CompanyDetail>({
    url: `/api/v1/companies/${companyId}`,
    method: 'get',
  })
}

/** 仅管理员 */
export function createCompany(payload: CompanyCreatePayload) {
  return request<CompanyDetail>({
    url: '/api/v1/companies',
    method: 'post',
    data: payload,
  })
}

/** 仅管理员 */
export function updateCompany(companyId: number, payload: CompanyUpdatePayload) {
  return request<CompanyDetail>({
    url: `/api/v1/companies/${companyId}`,
    method: 'put',
    data: payload,
  })
}

/** 仅管理员；后端返回 204 无响应体 */
export function deleteCompany(companyId: number) {
  return request<void>({
    url: `/api/v1/companies/${companyId}`,
    method: 'delete',
  })
}
