import { request } from '../client'
import type {
  CarbonQuota,
  HeatmapResponse,
  QuotaCreatePayload,
  QuotaTrade,
  ReductionPlanCreatePayload,
  ReductionPlanRecord,
  SupplierCreatePayload,
  SupplierRecord,
  SupplyChainEdgePayload,
  SupplyChainNetwork,
  SupplyChainReport,
  TradeCreatePayload,
  TradeReconciliation,
} from '../types'

/* ---------------- 供应商与拓扑 ---------------- */

export function createSupplier(payload: SupplierCreatePayload) {
  return request<SupplierRecord>({
    url: '/api/v1/supply-chain/suppliers',
    method: 'post',
    data: payload,
  })
}

export function listSuppliers(params: { company_id?: number } = {}) {
  return request<SupplierRecord[]>({
    url: '/api/v1/supply-chain/suppliers',
    method: 'get',
    params,
  })
}

export function createEdge(payload: SupplyChainEdgePayload) {
  return request<Record<string, unknown>>({
    url: '/api/v1/supply-chain/edges',
    method: 'post',
    data: payload,
  })
}

export function getNetwork(companyId: number) {
  return request<SupplyChainNetwork>({
    url: `/api/v1/supply-chain/${companyId}/network`,
    method: 'get',
  })
}

/** GNN 传播后的碳强度热力图与风险等级 */
export function getHeatmap(companyId: number) {
  return request<HeatmapResponse>({
    url: `/api/v1/supply-chain/${companyId}/heatmap`,
    method: 'get',
  })
}

/* ---------------- 配额与减排计划 ---------------- */

export function createQuota(payload: QuotaCreatePayload) {
  return request<Record<string, unknown>>({
    url: '/api/v1/supply-chain/quotas',
    method: 'post',
    data: payload,
  })
}

export function listQuotas(companyId: number) {
  return request<CarbonQuota[]>({
    url: `/api/v1/supply-chain/${companyId}/quotas`,
    method: 'get',
  })
}

export function createReductionPlan(companyId: number, payload: ReductionPlanCreatePayload) {
  return request<Record<string, unknown>>({
    url: `/api/v1/supply-chain/${companyId}/reduction-plans`,
    method: 'post',
    // 后端 schema 将 company_id 设为必填，路径参数同时会覆盖该值
    data: { ...payload, company_id: companyId },
  })
}

export function listReductionPlans(companyId: number) {
  return request<ReductionPlanRecord[]>({
    url: `/api/v1/supply-chain/${companyId}/reduction-plans`,
    method: 'get',
  })
}

export function getSupplyChainReport(companyId: number) {
  return request<SupplyChainReport>({
    url: `/api/v1/supply-chain/${companyId}/report`,
    method: 'get',
  })
}

/* ---------------- 跨企业配额交易 ---------------- */

export function createTrade(payload: TradeCreatePayload) {
  return request<QuotaTrade>({
    url: '/api/v1/supply-chain/trades',
    method: 'post',
    data: payload,
  })
}

export function acceptTrade(tradeId: string, note?: string) {
  return request<QuotaTrade>({
    url: `/api/v1/supply-chain/trades/${tradeId}/accept`,
    method: 'post',
    data: note ? { note } : undefined,
  })
}

export function declineTrade(tradeId: string) {
  return request<QuotaTrade>({
    url: `/api/v1/supply-chain/trades/${tradeId}/decline`,
    method: 'post',
  })
}

export function listTrades(companyId: number) {
  return request<QuotaTrade[]>({
    url: `/api/v1/supply-chain/${companyId}/trades`,
    method: 'get',
  })
}

export function getTradeReconciliation(companyId: number) {
  return request<TradeReconciliation>({
    url: `/api/v1/supply-chain/${companyId}/trades/report`,
    method: 'get',
  })
}
