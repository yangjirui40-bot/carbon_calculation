import type { DocumentDetail } from '../api/types'
import { mockDocuments } from './documents'

function baseDocument(id: string): DocumentDetail {
  const document = mockDocuments.find((item) => item.id === id)
  if (!document) throw new Error(`Mock 单据不存在：${id}`)
  return { ...document, fields: [] }
}

/**
 * 两张待核对单据的识别字段。
 * 置信度阈值 0.95：低于阈值的字段 needs_review = true。
 * TODO(contract): 字段 key、结构与 OCR 是否返回 bbox 待杨济瑞契约确认；当前不提供 bbox。
 */
export const mockDocumentDetails: Record<string, DocumentDetail> = {
  'doc-001': {
    ...baseDocument('doc-001'),
    fields: [
      {
        key: 'invoice_number',
        label: '发票号码',
        value: '044002100123',
        confidence: 0.97,
        needs_review: false,
      },
      {
        key: 'invoice_date',
        label: '开票日期',
        value: '2026-10-12',
        confidence: 0.98,
        needs_review: false,
      },
      {
        key: 'supplier_name',
        label: '供应商',
        value: '某电子材料商',
        confidence: 0.66,
        needs_review: true,
        review_reason: '供应商名称与采购单不一致',
      },
      {
        key: 'item_name',
        label: '事项名称',
        value: '电子元器件采购',
        confidence: 0.94,
        needs_review: true,
        review_reason: '事项名称较笼统，请确认业务类别',
      },
      {
        key: 'amount',
        label: '未税金额',
        value: 10000,
        confidence: 0.99,
        needs_review: false,
      },
      {
        key: 'tax_amount',
        label: '税额',
        value: 1300,
        confidence: 0.62,
        needs_review: true,
        review_reason: '税额与价税合计推算不一致，请核对',
      },
      {
        key: 'total_amount',
        label: '价税合计',
        value: 11300,
        confidence: 0.72,
        needs_review: true,
        review_reason: '与票面合计不一致，请核对',
      },
      {
        key: 'category',
        label: '业务类别',
        value: 'electronic_components',
        confidence: 0.96,
        needs_review: false,
      },
    ],
  },
  'doc-005': {
    ...baseDocument('doc-005'),
    fields: [
      {
        key: 'document_number',
        label: '单据编号',
        value: 'JY-20261009-05',
        confidence: 0.92,
        needs_review: true,
        review_reason: '手写编号，识别不确定',
      },
      {
        key: 'business_date',
        label: '业务日期',
        value: '2026-10-09',
        confidence: 0.97,
        needs_review: false,
      },
      {
        key: 'supplier_name',
        label: '供应商',
        value: '某加油站',
        confidence: 0.96,
        needs_review: false,
      },
      {
        key: 'fuel_type',
        label: '油品',
        value: '柴油',
        confidence: 0.98,
        needs_review: false,
      },
      {
        key: 'quantity',
        label: '数量',
        value: 40,
        confidence: 0.88,
        needs_review: true,
        review_reason: '手写数量，建议对照耗用台账',
      },
      {
        key: 'unit_price',
        label: '单价',
        value: 24,
        confidence: 0.95,
        needs_review: false,
      },
      {
        key: 'total_amount',
        label: '金额',
        value: 960,
        confidence: 0.99,
        needs_review: false,
      },
      {
        key: 'category',
        label: '业务类别',
        value: 'diesel_combustion',
        confidence: 0.99,
        needs_review: false,
      },
    ],
  },
}
