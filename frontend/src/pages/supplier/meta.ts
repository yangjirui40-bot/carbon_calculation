import dayjs from 'dayjs'
import { ApiRequestError } from '../../api/client'
import type { RiskLevel } from '../../api/types'
import { EMPTY_VALUE } from '../../utils/format'

/** 供应商门户的展示文案与格式规则；页面只引用，不重复写映射 */

export type RiskTone = 'green' | 'yellow' | 'red' | 'neutral'

export const RISK_META: Record<RiskLevel, { label: string; tone: RiskTone }> = {
  unknown: { label: '数据不足，待补充', tone: 'neutral' },
  green: { label: '低风险', tone: 'green' },
  yellow: { label: '中风险', tone: 'yellow' },
  red: { label: '高风险', tone: 'red' },
}

/** 后端 risk_level 为字符串，遇到未约定值按中性色展示，不崩溃 */
export function riskMeta(level: string): {
  label: string
  tone: RiskTone | 'neutral'
} {
  return RISK_META[level as RiskLevel] ?? { label: level || '未评级', tone: 'neutral' }
}

const TIER_LABELS: Record<number, string> = {
  1: '一级供应商',
  2: '二级供应商',
  3: '三级供应商',
}

export function tierLabel(tier: number): string {
  return TIER_LABELS[tier] ?? `Tier ${tier}`
}

const PLAN_STATUS_LABELS: Record<string, string> = {
  ongoing: '进行中',
  completed: '已完成',
  overdue: '已逾期',
}

export function planStatusLabel(status: string): string {
  return PLAN_STATUS_LABELS[status] ?? status
}

export function planStatusTone(status: string): 'ongoing' | 'completed' | 'overdue' | 'default' {
  if (status === 'ongoing' || status === 'completed' || status === 'overdue') {
    return status
  }
  return 'default'
}

/** 后端 detail 已由 ApiRequestError 归一成 message，这里只做兜底 */
export function requestErrorMessage(error: unknown): string {
  return error instanceof ApiRequestError
    ? error.message
    : '请求失败，请稍后重试'
}

/** 减排计划截止日期：只显示日期，不显示时间 */
export function formatDeadline(value: string | null | undefined): string {
  if (!value) return EMPTY_VALUE
  const date = dayjs(value)
  return date.isValid() ? date.format('YYYY-MM-DD') : EMPTY_VALUE
}
