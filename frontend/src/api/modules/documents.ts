import { request } from '../client'
import type {
  DocumentParseResponse,
  DocumentReviewPayload,
  DocumentReviewResponse,
  DocumentUploadResponse,
  DocumentVerifyResponse,
  ReviewQueueResponse,
  SourceDocument,
} from '../types'

export interface DocumentListParams {
  company_id?: number
}

export function listDocuments(params: DocumentListParams = {}) {
  return request<SourceDocument[]>({
    url: '/api/v1/documents',
    method: 'get',
    params,
  })
}

export function getDocument(docId: number) {
  return request<SourceDocument>({
    url: `/api/v1/documents/${docId}`,
    method: 'get',
  })
}

/** 人工复核队列：低置信度 / 纠偏 / 验真失败 */
export function getReviewQueue(params: { company_id?: number; confidence_threshold?: number } = {}) {
  return request<ReviewQueueResponse>({
    url: '/api/v1/documents/review-queue',
    method: 'get',
    params,
  })
}

/** 上传原始单据（multipart 字段名 file，company_id 走 query） */
export function uploadDocument(file: File, companyId: number, docType = 'invoice') {
  const form = new FormData()
  form.append('file', file)
  return request<DocumentUploadResponse>({
    url: '/api/v1/documents/upload',
    method: 'post',
    params: { company_id: companyId, doc_type: docType },
    data: form,
  })
}

/** 提交异步解析；wait=true 时后端阻塞至完成（最长 300 秒） */
export function parseDocument(docId: number, wait = false) {
  return request<DocumentParseResponse | SourceDocument>({
    url: `/api/v1/documents/${docId}/parse`,
    method: 'post',
    params: { wait },
    timeout: wait ? 330_000 : undefined,
  })
}

/** 复核确认（入库）或驳回 */
export function reviewDocument(docId: number, payload: DocumentReviewPayload) {
  return request<DocumentReviewResponse>({
    url: `/api/v1/documents/${docId}/review`,
    method: 'post',
    data: payload,
  })
}

/** 发票验真；未配置税务查验服务时后端标记 unverified */
export function verifyDocument(docId: number) {
  return request<DocumentVerifyResponse>({
    url: `/api/v1/documents/${docId}/verify`,
    method: 'post',
  })
}
