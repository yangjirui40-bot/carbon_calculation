import { request } from '../client'
import type {
  CalculationRunDetail,
  CalculationRunSummary,
  EIOLCAPayload,
  EIOLCAResultData,
  EIOLCATablePayload,
  EIOLCATableResponse,
  EngineResponse,
  EnterpriseCalcPayload,
  EnterpriseResultData,
  PCFResultData,
  ProductCalcPayload,
  UncertaintyResponse,
} from '../types'

/** 企业 Scope 1/2/3 核算；不传 records 时后端读取已确认记录 */
export function runEnterprise(payload: EnterpriseCalcPayload) {
  return request<EngineResponse<EnterpriseResultData>>({
    url: '/api/v1/calculations/enterprise',
    method: 'post',
    data: payload,
  })
}

export function runEiolca(payload: EIOLCAPayload) {
  return request<EngineResponse<EIOLCAResultData>>({
    url: '/api/v1/calculations/eiolca',
    method: 'post',
    data: payload,
  })
}

/** 产品 BOM 核算；传 product_id 由后端读取 BOM，或直接传 product + bom_items */
export function runProduct(payload: ProductCalcPayload) {
  return request<EngineResponse<PCFResultData>>({
    url: '/api/v1/calculations/product',
    method: 'post',
    data: payload,
  })
}

export interface RunListParams {
  company_id?: number
  operation?: string
}

/** 核算任务列表，后端最多返回 200 条 */
export function listRuns(params: RunListParams = {}) {
  return request<CalculationRunSummary[]>({
    url: '/api/v1/calculations',
    method: 'get',
    params,
  })
}

export function getRun(runId: string) {
  return request<CalculationRunDetail>({
    url: `/api/v1/calculations/${runId}`,
    method: 'get',
  })
}

/** 不确定性分析：95% 置信区间与敏感性排名 */
export function getUncertainty(runId: string) {
  return request<UncertaintyResponse>({
    url: `/api/v1/calculations/${runId}/uncertainty`,
    method: 'get',
  })
}

/** 基于真实 42 部门投入产出表的 EIO-LCA */
export function runEiolcaTable(payload: EIOLCATablePayload) {
  return request<EIOLCATableResponse>({
    url: '/api/v1/calculations/eiolca/table',
    method: 'post',
    data: payload,
  })
}
