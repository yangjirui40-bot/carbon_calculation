import type { TransactionCategory } from '../../../api/types'
import { CATEGORY_LABELS } from '../../../config/business'
import type { SwissChartPalette } from '../../../utils/chartTheme'

export const CHART_HEIGHT = 320

export function scopeName(scope: string): string {
  if (scope === 'scope1') return 'Scope 1'
  if (scope === 'scope2') return 'Scope 2'
  if (scope === 'scope3') return 'Scope 3'
  return scope
}

export function scopeColor(scope: string, palette: SwissChartPalette): string {
  if (scope === 'scope1') return palette.s1
  if (scope === 'scope2') return palette.s2
  if (scope === 'scope3') return palette.s3
  return palette.muted
}

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category as TransactionCategory] ?? category
}
