import type { RecordClassification } from '../../api/types'
import type { DashboardData } from './types'
import { formatNumber } from '../../utils/format'

export const tonnes = (kg: number) => formatNumber(kg / 1000)
export const signedTonnes = (kg: number) => (kg > 0 ? '+' : kg < 0 ? '−' : '') + tonnes(Math.abs(kg))

export function precedingMonth(data: DashboardData) {
  const period = data.summary.period
  if (!period || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return undefined
  const [year, month] = period.split('-').map(Number)
  const previous = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`
  return data.trend.historical.find(point => point.period === previous)
}

export function locationKey(row: RecordClassification) {
  return JSON.stringify([row.site_id ?? null, row.workshop ?? null, row.production_line ?? null])
}

export function locationLabel(row: RecordClassification) {
  return [row.site_name, row.workshop || '未归集车间', row.production_line].filter(Boolean).join(' / ')
}
