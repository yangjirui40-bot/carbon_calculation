import dayjs from 'dayjs'
import type { BillingPlan } from '../../api/types'
import type { Role } from '../../config/roles'
import { EMPTY_VALUE, formatAmount, formatNumber } from '../../utils/format'

/** 后端订阅状态 → 页面文字；未知状态原样保留 */
const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  active: '有效',
  trial: '试用',
  expired: '已过期',
  canceled: '已取消',
  suspended: '已暂停',
}

export function subscriptionStatusText(status: string): string {
  return SUBSCRIPTION_STATUS_LABELS[status] ?? status
}

export function subscriptionStatusTone(status: string): 'accent' | 'warn' | 'fail' | 'muted' {
  if (status === 'active') return 'accent'
  if (status === 'trial') return 'warn'
  if (status === 'expired' || status === 'suspended') return 'fail'
  return 'muted'
}

/** 订阅起止只展示日期 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return EMPTY_VALUE
  const value = dayjs(iso)
  return value.isValid() ? value.format('YYYY-MM-DD') : EMPTY_VALUE
}

/** 用量 / 配额；配额缺失时只显示用量 */
export function usageText(usage: number, quota: number | null | undefined, unit: string): string {
  const used = formatNumber(usage, 0)
  if (typeof quota !== 'number' || !Number.isFinite(quota)) return `${used} ${unit}`
  return `${used} / ${formatNumber(quota, 0)} ${unit}`
}

export type UsageTone = 'default' | 'warn' | 'fail'

/** 比例只用于进度展示；配额缺失或非正数时不画比例 */
export function usageRatio(usage: number, quota: number | null | undefined): number | null {
  if (typeof quota !== 'number' || !Number.isFinite(quota) || quota <= 0) return null
  return usage / quota
}

/** 接近用尽 warn（≥80%），用尽 fail（≥100%） */
export function usageTone(usage: number, quota: number | null | undefined): UsageTone {
  if (typeof quota !== 'number' || !Number.isFinite(quota)) return 'default'
  if (quota <= 0) return 'fail'
  const ratio = usage / quota
  if (ratio >= 1) return 'fail'
  if (ratio >= 0.8) return 'warn'
  return 'default'
}

export function planPriceText(plan: BillingPlan): string {
  if (plan.price_yearly <= 0) return '免费'
  return `${formatAmount(plan.price_yearly)} / 年`
}

export type PlanAction = {
  enabled: boolean
  label: string
  reason?: string
}

type PlanActionInput = {
  plan: BillingPlan
  currentPlanCode: string | undefined
  role: Role | null
  hasCompany: boolean
}

/** 当前套餐 → 企业缺失 → 审计员只读 → 付费套餐仅管理员 → 可开通 */
export function resolvePlanAction({
  plan,
  currentPlanCode,
  role,
  hasCompany,
}: PlanActionInput): PlanAction {
  if (currentPlanCode === plan.plan_code) {
    return { enabled: false, label: '当前套餐' }
  }
  if (!hasCompany) {
    return { enabled: false, label: '先选择企业', reason: '订阅按企业生效，请先选择企业' }
  }
  if (role === 'auditor') {
    return { enabled: false, label: '只读', reason: '审计员仅可查看订阅信息' }
  }
  if (plan.plan_code !== 'free' && role !== 'admin') {
    return { enabled: false, label: '仅管理员开通', reason: '付费套餐仅管理员开通' }
  }
  return {
    enabled: true,
    label: plan.plan_code === 'free' ? '开通免费套餐' : '开通此套餐',
  }
}
