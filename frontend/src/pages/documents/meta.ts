/**
 * 单据域的展示映射与解析结果读取，只做展示层转换，不包含核算逻辑。
 * 字段名与后端 document_parser.FIELD_DEFS 对齐。
 */
import type {
  BackendParseStatus,
  DocumentReviewStatus,
  SourceDocument,
  VerifyStatus,
} from '../../api/types'

export const DOC_TYPE_OPTIONS = [
  { value: 'invoice', label: '增值税发票' },
  { value: 'electricity_bill', label: '电费单' },
] as const

export type DocTypeOption = (typeof DOC_TYPE_OPTIONS)[number]['value']

export function docTypeLabel(value: string | null | undefined): string {
  if (value === 'revenue_evidence') return '收入底稿'
  if (value === 'energy_certificate') return '绿电凭证'
  if (!value) return '—'
  return DOC_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value
}

export const PARSE_STATUS_LABELS: Record<BackendParseStatus, string> = {
  uploaded: '待解析',
  parsing: '解析中',
  parsed: '已解析',
  failed: '解析失败',
}

export const REVIEW_STATUS_LABELS: Record<DocumentReviewStatus, string> = {
  pending: '待复核',
  confirmed: '已入库',
  rejected: '已驳回',
}

export const VERIFY_STATUS_LABELS: Record<VerifyStatus, string> = {
  unverified: '未验真',
  verified: '验真通过',
  failed: '验真失败',
}

export type DocStatusTone = 'ok' | 'pending' | 'fail' | 'review'

export function docStatus(doc: SourceDocument): { label: string; tone: DocStatusTone } {
  if (['energy_certificate','revenue_evidence'].includes(doc.doc_type)) return { label: '凭证原件', tone: 'ok' }
  if (doc.parse_status === 'failed') return { label: '解析失败', tone: 'fail' }
  if (doc.parse_status === 'uploaded') return { label: '待解析', tone: 'pending' }
  if (doc.parse_status === 'parsing') return { label: '解析中', tone: 'pending' }
  if (doc.review_status === 'confirmed') return { label: '已入库', tone: 'ok' }
  if (doc.review_status === 'rejected') return { label: '已驳回', tone: 'fail' }
  return { label: '待复核', tone: 'review' }
}

/** 解析字段的中文名（document_parser.FIELD_DEFS） */
export const FIELD_LABELS: Record<string, string> = {
  total_amount: '价税合计',
  tax_amount: '税额',
  tax_exclusive_amount: '不含税金额',
  quantity: '数量',
  unit_price: '单价',
  tax_rate: '税率',
  invoice_date: '开票日期',
  period: '所属期',
  vendor: '销售方',
  buyer: '购买方',
  invoice_no: '发票号码',
  meter_no: '户号',
}

/** 页面展示顺序；未知字段追加在末尾 */
export const FIELD_ORDER = [
  'total_amount',
  'tax_amount',
  'tax_exclusive_amount',
  'unit_price',
  'quantity',
  'tax_rate',
  'invoice_date',
  'period',
  'vendor',
  'buyer',
  'invoice_no',
  'meter_no',
]

export function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key
}

/** 后端以数字类型返回的字段，提交修订时需要还原成 number */
export const NUMERIC_FIELD_KEYS = new Set([
  'total_amount',
  'tax_amount',
  'tax_exclusive_amount',
  'quantity',
  'unit_price',
  'tax_rate',
])

export interface RecordHint {
  period?: string | null
  category?: string | null
  scope?: string | null
  quantity?: number | null
  unit?: string | null
  amount?: number | null
  currency?: string | null
  factor_id?: string | null
}

export interface CorrectionStep {
  field?: string
  rule?: string
  before?: unknown
  after?: unknown
  engine?: string
  review?: unknown
  context?: Record<string, unknown>
}

export interface ParsedExtraction {
  fields: Record<string, unknown>
  hint: RecordHint
  corrections: CorrectionStep[]
}

/** 读取 SourceDocument.extracted_fields（后端解密后为 { fields, record_hint, fingerprint }） */
export function parseExtraction(
  extracted: unknown,
  correctionLog: unknown,
): ParsedExtraction {
  const secret =
    typeof extracted === 'object' && extracted !== null
      ? (extracted as { fields?: unknown; record_hint?: unknown })
      : {}
  const fields =
    typeof secret.fields === 'object' && secret.fields !== null
      ? (secret.fields as Record<string, unknown>)
      : {}
  const hint =
    typeof secret.record_hint === 'object' && secret.record_hint !== null
      ? (secret.record_hint as RecordHint)
      : {}
  const corrections = Array.isArray(correctionLog)
    ? (correctionLog.filter(
        (step) => typeof step === 'object' && step !== null,
      ) as CorrectionStep[])
    : []
  return { fields, hint, corrections }
}

/** 按业务顺序排列字段，未知字段保持后端顺序追加 */
export function orderedFieldKeys(fields: Record<string, unknown>): string[] {
  const known = FIELD_ORDER.filter((key) => key in fields)
  const unknown = Object.keys(fields).filter((key) => !FIELD_ORDER.includes(key))
  return [...known, ...unknown]
}

/** 单条纠偏说明：金额类展示 before → after */
export function correctionText(step: CorrectionStep): string | null {
  if (!step.field) return null
  const label = fieldLabel(step.field)
  const before = formatRaw(step.before)
  const after = formatRaw(step.after)
  const rule = step.rule ? ` · ${step.rule}` : ''
  return `${label}：${before} → ${after}${rule}`
}

function formatRaw(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)))
  return String(value)
}
