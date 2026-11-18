/** 业务记录页的显示映射与表单选项；后端字段值保持 snake_case。 */

export const CATEGORY_LABELS: Record<string, string> = {
  diesel_combustion: '柴油燃烧',
  gasoline_combustion: '汽油燃烧',
  electricity: '外购电力',
  electronic_components: '电子元器件',
  pcb_materials: 'PCB 材料',
  packaging_materials: '包装材料',
}

export function categoryLabel(value: string): string {
  return CATEGORY_LABELS[value] ?? value
}

const SCOPE_LABELS: Record<string, string> = {
  scope1: 'Scope 1',
  scope2: 'Scope 2',
  scope3: 'Scope 3',
}

export function scopeLabel(value: string): string {
  return SCOPE_LABELS[value] ?? value
}

const REVIEW_STATUS_LABELS: Record<string, string> = {
  pending: '待复核',
  confirmed: '已确认',
  rejected: '已驳回',
}

export type ReviewStatusTone = 'pending' | 'confirmed' | 'rejected' | 'other'

export function reviewStatusLabel(value: string): string {
  return REVIEW_STATUS_LABELS[value] ?? value
}

export function reviewStatusTone(value: string): ReviewStatusTone {
  if (value === 'pending' || value === 'confirmed' || value === 'rejected') return value
  return 'other'
}

const SOURCE_LABELS: Record<string, string> = {
  manual: '手工录入',
  excel: '批量导入',
  document: '单据识别',
}

export function sourceLabel(value: string): string {
  return SOURCE_LABELS[value] ?? value
}

export const SCOPE_OPTIONS = [
  { value: 'scope1', label: 'Scope 1' },
  { value: 'scope2', label: 'Scope 2' },
  { value: 'scope3', label: 'Scope 3' },
]

export const REVIEW_STATUS_OPTIONS = [
  { value: 'pending', label: '待复核' },
  { value: 'confirmed', label: '已确认' },
  { value: 'rejected', label: '已驳回' },
]

/** 类别 → Scope 的界面默认映射；后端 factors.py 的 _CATEGORY_SCOPE 未列汽油，页面新建会显式发送 scope */
const CATEGORY_SCOPE: Record<string, string> = {
  diesel_combustion: 'scope1',
  gasoline_combustion: 'scope1',
  electricity: 'scope2',
  electronic_components: 'scope3',
  pcb_materials: 'scope3',
  packaging_materials: 'scope3',
}

export function inferScope(category: string): string {
  return CATEGORY_SCOPE[category] ?? 'scope3'
}

/** 因子单位形如 kgCO2e/kWh，分母即活动数据单位；换算不了时返回空串 */
export function unitFromFactorUnit(factorUnit: string): string {
  const mark = factorUnit.lastIndexOf('/')
  if (mark < 0) return ''
  return factorUnit.slice(mark + 1).trim()
}
