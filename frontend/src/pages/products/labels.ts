/** 产品碳足迹与减排模拟器共用的展示文案（只做翻译与格式化，不含业务计算）。 */

import { formatNumber } from '../../utils/format'

export const CATEGORY_LABELS: Record<string, string> = {
  electronic_components: '电子元器件',
  pcb_materials: 'PCB 材料',
  packaging_materials: '包装材料',
}

export function categoryLabel(value: string | null | undefined): string {
  if (!value) return '—'
  return CATEGORY_LABELS[value] ?? value
}

/** 产量可能是小数，整数时不显示多余小数位 */
export function formatQuantity(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return Number.isInteger(value) ? formatNumber(value, 0) : formatNumber(value, 2)
}

/** 置信度 0—1 → 百分比；后端可能给 0—100，按量级兼容展示 */
export function formatConfidence(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  const ratio = value > 1 ? value / 100 : value
  return `${(ratio * 100).toFixed(0)}%`
}

/**
 * 保留因子来源和适用性提示，便于使用者判断结果。
 * 这里只过滤展示文本，不改后端数据。
 */
export function visibleWarnings(warnings: string[] | null | undefined): string[] {
  return warnings ?? []
}

export function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : '请求失败，请稍后重试'
}
