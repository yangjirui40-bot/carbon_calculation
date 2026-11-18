import { request } from '../client'
import type {
  FactorCreatePayload,
  FactorImportResult,
  FactorRecord,
  FactorSetsResponse,
} from '../types'

export interface FactorListParams {
  category?: string
  version?: string
}

export function listFactors(params: FactorListParams = {}) {
  return request<FactorRecord[]>({
    url: '/api/v1/factors',
    method: 'get',
    params,
  })
}

/** 官方因子集（official-2022 / official-2022-hunan / official-2022-hz / official-2024-footprint） */
export function listFactorSets() {
  return request<FactorSetsResponse>({
    url: '/api/v1/factors/sets',
    method: 'get',
  })
}

export function getFactor(factorId: string) {
  return request<FactorRecord>({
    url: `/api/v1/factors/${factorId}`,
    method: 'get',
  })
}

/** 仅管理员 */
export function createFactor(payload: FactorCreatePayload) {
  return request<FactorRecord>({
    url: '/api/v1/factors',
    method: 'post',
    data: payload,
  })
}

/** 仅管理员：由 42 部门投入产出表推导 Scope 3 官方因子 */
export function deriveFromIO() {
  return request<{ derived: Array<Record<string, unknown>> }>({
    url: '/api/v1/factors/derive-from-io',
    method: 'post',
  })
}

/** 仅管理员：上传 CSV 批量导入因子 */
export function importFactors(file: File) {
  const form = new FormData()
  form.append('file', file)
  return request<FactorImportResult>({
    url: '/api/v1/factors/import',
    method: 'post',
    data: form,
  })
}
