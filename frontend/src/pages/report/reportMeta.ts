import { formatDateTime } from '../../utils/format'

/** 报告类型与状态的展示文案；后端取值见 report_service.py */

export function reportTypeLabel(type: string | null | undefined): string {
  if (type === 'ISO14064') return 'ISO 14064'
  if (type === 'PCF') return 'ISO 14067'
  return type || '—'
}

export function reportStatusLabel(status: string | null | undefined): string {
  if (!status) return '—'
  if (status === 'generated') return '已生成'
  return status
}

/**
 * SQLite 会把 UTC 时间存成不带时区的 ISO 字符串，
 * 直接交给 dayjs 会被当成本地时间；补 Z 后再格式化，和报告 content 的 generated_at 一致。
 */
export function formatBackendDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  if (!value.includes('T')) return formatDateTime(value)
  const hasTimeZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value)
  return formatDateTime(hasTimeZone ? value : `${value}Z`)
}
