import dayjs from 'dayjs'
import type { Scope } from '../api/types'

/**
 * 展示层格式化。
 * 只做“显示成什么样”，不做任何排放计算或单位换算以外的业务逻辑。
 * 规则来源：02 §5、02 §6.4。
 */

export const EMPTY_VALUE = '—'
export const EMISSION_UNIT = 'kgCO₂e'
export const TONNE_UNIT = 'tCO₂e'

/** Scope 枚举转页面显示：scope2 → Scope 2 */
export function formatScope(scope: Scope): string {
  return scope.replace('scope', 'Scope ')
}

/** 千分位，固定小数位；空值返回 — */
export function formatNumber(
  value: number | null | undefined,
  digits = 2,
): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return EMPTY_VALUE
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

/** 只返回数字部分，单位由调用方拼接 */
export function formatEmission(kg: number | null | undefined): string {
  return formatNumber(kg, 2)
}

/** kg 数值；≥1000 kg 时附带 tCO₂e 口径（单位换算，不是重算） */
export function formatEmissionWithTonnes(
  kg: number | null | undefined,
): string {
  if (typeof kg !== 'number' || !Number.isFinite(kg)) return EMPTY_VALUE
  const kgText = `${formatNumber(kg, 2)} ${EMISSION_UNIT}`
  if (Math.abs(kg) < 1000) return kgText
  return `${kgText}（${formatNumber(kg / 1000, 2)} ${TONNE_UNIT}）`
}

/** 金额：千分位两位小数；≥10000 元显示万元 */
export function formatAmount(yuan: number | null | undefined): string {
  if (typeof yuan !== 'number' || !Number.isFinite(yuan)) return EMPTY_VALUE
  if (Math.abs(yuan) >= 10000) {
    return `${formatNumber(yuan / 10000, 2)} 万元`
  }
  return `${formatNumber(yuan, 2)} 元`
}

/** 占比：输入 0—1，输出一位小数百分比 */
export function formatPercent(ratio: number | null | undefined): string {
  if (typeof ratio !== 'number' || !Number.isFinite(ratio)) return EMPTY_VALUE
  return `${(ratio * 100).toFixed(1)}%`
}

/** 统一 YYYY-MM-DD HH:mm；无效日期返回 — */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return EMPTY_VALUE
  const value = dayjs(iso)
  return value.isValid() ? value.format('YYYY-MM-DD HH:mm') : EMPTY_VALUE
}
