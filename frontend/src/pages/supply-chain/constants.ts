/** 供应链协同四页共用的显示映射与表单选项；后端字段值保持 snake_case。 */
import type { CompanyDetail, RiskLevel } from '../../api/types'

/** 配额与交易数量的单位（后端模型：kgCO2e） */
export const QUOTA_UNIT = 'kgCO₂e'
/** 交易单价单位（后端模型：元/kgCO2e） */
export const PRICE_UNIT = '元/kgCO₂e'
/** 供应商碳强度单位（后端模型：kgCO2e/CNY） */
export const INTENSITY_UNIT = 'kgCO₂e/元'

export const RISK_LEVELS: RiskLevel[] = ['red', 'yellow', 'green']

export const RISK_LABELS: Record<RiskLevel, string> = {
  red: '红 · 高风险',
  yellow: '黄 · 中风险',
  green: '绿 · 低风险',
}

export const RISK_OPTIONS: Array<{ value: RiskLevel; label: string }> = [
  { value: 'red', label: '高风险（红）' },
  { value: 'yellow', label: '中风险（黄）' },
  { value: 'green', label: '低风险（绿）' },
]

const TIER_LABELS: Record<number, string> = {
  0: '本企业',
  1: '一级供应商',
  2: '二级供应商',
  3: '三级供应商',
}

export function tierLabel(tier: number): string {
  return TIER_LABELS[tier] ?? `${tier} 级供应商`
}

export const PLAN_STATUS_LABELS: Record<string, string> = {
  ongoing: '进行中',
  completed: '已完成',
  overdue: '已逾期',
}

export function planStatusLabel(value: string): string {
  return PLAN_STATUS_LABELS[value] ?? value
}

export type StatusTone = 'ok' | 'warn' | 'fail' | 'muted'

export function planStatusTone(value: string): StatusTone {
  if (value === 'completed') return 'ok'
  if (value === 'ongoing') return 'warn'
  if (value === 'overdue') return 'fail'
  return 'muted'
}

export const TRADE_STATUS_LABELS: Record<string, string> = {
  pending: '待处理',
  accepted: '已接受',
  declined: '已拒绝',
}

export function tradeStatusLabel(value: string): string {
  return TRADE_STATUS_LABELS[value] ?? value
}

export function tradeStatusTone(value: string): StatusTone {
  if (value === 'accepted') return 'ok'
  if (value === 'pending') return 'warn'
  if (value === 'declined') return 'fail'
  return 'muted'
}

export function companyNameById(
  companies: CompanyDetail[],
  companyId: number | null | undefined,
): string {
  if (companyId === null || companyId === undefined) return '—'
  return companies.find((company) => company.id === companyId)?.name ?? `企业 #${companyId}`
}

/** 目标年份默认取当前自然年，与后端默认值保持一致 */
export function currentYear(): number {
  return new Date().getFullYear()
}
