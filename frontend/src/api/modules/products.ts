import { request } from '../client'
import type {
  BomImportResult,
  BomItemPayload,
  BomMatchResult,
  PCFResultData,
  ProductCreatePayload,
  ProductDetail,
  ProductRecord,
  ReportGenerationResponse,
  ReportNotFound,
} from '../types'

export function listProducts(params: { company_id?: number } = {}) {
  return request<ProductRecord[]>({
    url: '/api/v1/products',
    method: 'get',
    params,
  })
}

export function getProduct(productId: string) {
  return request<ProductDetail>({
    url: `/api/v1/products/${productId}`,
    method: 'get',
  })
}

export function createProduct(payload: ProductCreatePayload) {
  return request<ProductRecord>({
    url: '/api/v1/products',
    method: 'post',
    data: payload,
  })
}

export function importBom(productId: string, bomItems: BomItemPayload[]) {
  return request<BomImportResult>({
    url: `/api/v1/products/${productId}/bom`,
    method: 'post',
    data: { bom_items: bomItems },
  })
}

/** SBERT 语义匹配 BOM 物料 → 类别与因子 */
export function matchBom(productId: string) {
  return request<BomMatchResult>({
    url: `/api/v1/products/${productId}/match`,
    method: 'post',
  })
}

/** 触发 PCF 核算（等价于 /calculations/product + product_id） */
export function calculateProduct(productId: string) {
  return request<{
    success: boolean
    run_id: string
    operation: string
    status: string
    data: PCFResultData
    warnings: string[]
    model_version: string
  }>({
    url: `/api/v1/products/${productId}/calculate`,
    method: 'post',
  })
}

/** 生成并保存 PCF 报告；无可用核算结果时 found=false */
export function generateProductReport(productId: string, language = 'zh', runId?: string) {
  return request<ReportGenerationResponse | ReportNotFound>({
    url: `/api/v1/products/${productId}/report`,
    method: 'get',
    params: { language, run_id: runId },
  })
}

export function setBomFactor(productId: string, itemId: string, factorId: string) {
  return request<import('../types').ProductBomLine>({
    url: `/api/v1/products/${encodeURIComponent(productId)}/bom/${encodeURIComponent(itemId)}/factor`,
    method: 'put',
    data: { factor_id: factorId },
  })
}

export function importBomFile(productId: string, file: File, preview: boolean) {
  const data = new FormData()
  data.append('file', file)
  return request<BomImportResult>({
    url: `/api/v1/products/${encodeURIComponent(productId)}/bom/import`,
    method: 'post',
    params: { preview },
    data,
    timeout: 60_000,
  })
}
