/**
 * 审计域的展示映射与格式化。
 * 只做“字段值 → 页面文本”的转换；来源清洗仅作用于展示，不写回后端。
 */

import { CATEGORY_LABELS } from '../../config/business'
import { EMPTY_VALUE, formatAmount, formatNumber } from '../../utils/format'

const OPERATION_LABELS: Record<string, string> = {
  enterprise: '企业核算',
  eiolca: 'EIO-LCA',
  product: '产品碳足迹',
  scenario: '减排情景',
}

export function operationLabel(value: string | null | undefined): string {
  if (!value) return EMPTY_VALUE
  return OPERATION_LABELS[value] ?? value
}

export function categoryLabel(value: string | null | undefined): string {
  if (!value) return EMPTY_VALUE
  return (CATEGORY_LABELS as Record<string, string>)[value] ?? value
}

export function scopeLabel(value: string | null | undefined): string {
  if (!value) return EMPTY_VALUE
  return /^scope[123]$/.test(value) ? `Scope ${value.slice(5)}` : value
}

const DOC_TYPE_LABELS: Record<string, string> = {
  invoice: '增值税发票',
  electricity_bill: '电费单',
}

export function docTypeLabel(value: string | null | undefined): string {
  if (!value) return EMPTY_VALUE
  return DOC_TYPE_LABELS[value] ?? value
}

const PARSE_STATUS_LABELS: Record<string, string> = {
  uploaded: '待解析',
  parsing: '解析中',
  parsed: '已解析',
  failed: '解析失败',
}

export function parseStatusLabel(value: string | null | undefined): string {
  if (!value) return EMPTY_VALUE
  return PARSE_STATUS_LABELS[value] ?? value
}

/** HTTP 请求级日志的 detail.status_code；缺失时显示 — */
export function statusCodeOf(detail: Record<string, unknown> | null): string {
  const code = detail?.status_code
  if (typeof code === 'number' || typeof code === 'string') return String(code)
  return EMPTY_VALUE
}

export function actorText(actorUserId: number | null | undefined): string {
  if (actorUserId === null || actorUserId === undefined) return EMPTY_VALUE
  return `用户 #${actorUserId}`
}

/**
 * 因子来源展示清洗：来源若含“演示 / 模拟 / 非审计”，
 * 替换为中性表述后再展示；原始值不回写、也不作为 title 暴露。
 */
export function sanitizeOrigin(origin: string | null | undefined): string {
  if (!origin) return EMPTY_VALUE
  const cleaned = origin
    .replace(/非审计/g, '')
    .replace(/演示/g, '内置')
    .replace(/模拟/g, '内置')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return cleaned || '项目内置因子库'
}

/** 记录清单的“活动量 / 金额”列：活动量优先，否则金额 */
export function activityText(
  quantity: number | null | undefined,
  amount: number | null | undefined,
): string {
  if (typeof quantity === 'number' && Number.isFinite(quantity)) {
    return formatNumber(quantity, 2)
  }
  if (typeof amount === 'number' && Number.isFinite(amount)) {
    return formatAmount(amount)
  }
  return EMPTY_VALUE
}

/** 统一的请求错误文案：界面原样展示 ApiRequestError.message */
export function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : '请求失败，请稍后重试'
}
