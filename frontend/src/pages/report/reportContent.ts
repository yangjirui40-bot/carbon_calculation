import { CATEGORY_LABELS } from '../../config/business'
import { EMPTY_VALUE } from '../../utils/format'

/**
 * 报告 content 的类型收窄。
 * 后端 content 是 Record<string, unknown>，页面一律经这里读出受控字段，
 * 缺失字段保持 null，由展示层统一显示 —。
 */

export type UnknownRecord = Record<string, unknown>

export type IsoReportItem = {
  recordId: string | null
  scope: string | null
  category: string | null
  factorId: string | null
  factorVersion: string | null
  activity: number | null
  basisUnit: string | null
  emissionsKg: number | null
}

export type PcfReportItem = {
  bomItemId: string | null
  materialName: string | null
  category: string | null
  materialAmountCny: number | null
  factorId: string | null
  factorVersion: string | null
  emissionsKg: number | null
}

export type IsoReportContent = {
  standard: string | null
  companyName: string | null
  companyCode: string | null
  companyIndustry: string | null
  reportingPeriod: string | null
  totalKg: number | null
  scope1: number | null
  scope2: number | null
  scope3: number | null
  items: IsoReportItem[]
  factorVersions: string[]
  boundary: string | null
  dataQualityNote: string | null
  generatedAt: string | null
}

export type PcfReportContent = {
  standard: string | null
  productId: string | null
  productName: string | null
  outputQuantity: number | null
  productUnit: string | null
  totalUpstreamKg: number | null
  unitProductKg: number | null
  unitLabel: string | null
  items: PcfReportItem[]
  boundary: string | null
  dataQualityNote: string | null
  generatedAt: string | null
}

export type FactorVersionRow = {
  factorId: string
  factorVersion: string
}

export function asRecord(value: unknown): UnknownRecord | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  return value as UnknownRecord
}

function readString(record: UnknownRecord | null, key: string): string | null {
  const value = record?.[key]
  return typeof value === 'string' && value.trim() ? value : null
}

function readNumber(record: UnknownRecord | null, key: string): number | null {
  const value = record?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readArray(record: UnknownRecord | null, key: string): unknown[] {
  const value = record?.[key]
  return Array.isArray(value) ? value : []
}

function readStringArray(record: UnknownRecord | null, key: string): string[] {
  return readArray(record, key).filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  )
}

function readIsoItem(value: unknown): IsoReportItem | null {
  const record = asRecord(value)
  if (!record) return null
  return {
    recordId: readString(record, 'record_id'),
    scope: readString(record, 'scope'),
    category: readString(record, 'category'),
    factorId: readString(record, 'factor_id'),
    factorVersion: readString(record, 'factor_version'),
    activity: readNumber(record, 'activity_or_amount'),
    basisUnit: readString(record, 'basis_unit'),
    emissionsKg: readNumber(record, 'emissions_kgco2e'),
  }
}

function readPcfItem(value: unknown): PcfReportItem | null {
  const record = asRecord(value)
  if (!record) return null
  return {
    bomItemId: readString(record, 'bom_item_id'),
    materialName: displayText(readString(record, 'material_name')),
    category: readString(record, 'category'),
    materialAmountCny: readNumber(record, 'material_amount_cny'),
    factorId: readString(record, 'factor_id'),
    factorVersion: readString(record, 'factor_version'),
    emissionsKg: readNumber(record, 'emissions_kgco2e'),
  }
}

export function readIsoContent(content: UnknownRecord | null): IsoReportContent {
  const company = asRecord(content?.['company'])
  const scope = asRecord(content?.['scope_breakdown'])
  const items = readArray(content, 'items')
    .map(readIsoItem)
    .filter((item): item is IsoReportItem => item !== null)

  return {
    standard: readString(content, 'standard'),
    companyName: displayText(readString(company, 'name')),
    companyCode: readString(company, 'code'),
    companyIndustry: displayText(readString(company, 'industry')),
    reportingPeriod: readString(content, 'reporting_period'),
    totalKg: readNumber(content, 'total_kgco2e'),
    scope1: readNumber(scope, 'scope1'),
    scope2: readNumber(scope, 'scope2'),
    scope3: readNumber(scope, 'scope3'),
    items,
    factorVersions: readStringArray(content, 'factor_versions'),
    boundary: displayText(readString(content, 'boundary')),
    dataQualityNote: displayText(readString(content, 'data_quality_note')),
    generatedAt: readString(content, 'generated_at'),
  }
}

export function readPcfContent(content: UnknownRecord | null): PcfReportContent {
  const product = asRecord(content?.['product'])
  const items = readArray(content, 'items')
    .map(readPcfItem)
    .filter((item): item is PcfReportItem => item !== null)

  return {
    standard: readString(content, 'standard'),
    productId: readString(product, 'product_id'),
    productName: displayText(readString(product, 'product_name')),
    outputQuantity: readNumber(product, 'output_quantity'),
    productUnit: displayText(readString(product, 'product_unit')),
    totalUpstreamKg: readNumber(content, 'total_upstream_emissions_kgco2e'),
    unitProductKg: readNumber(content, 'unit_product_emissions_kgco2e'),
    unitLabel: displayText(readString(content, 'unit_label')),
    items,
    boundary: displayText(readString(content, 'boundary')),
    dataQualityNote: displayText(readString(content, 'data_quality_note')),
    generatedAt: readString(content, 'generated_at'),
  }
}

const CATEGORY_LABEL_BY_KEY: Record<string, string> = { ...CATEGORY_LABELS }

export function categoryLabel(value: string | null): string {
  if (!value) return EMPTY_VALUE
  return CATEGORY_LABEL_BY_KEY[value] ?? value
}

const SCOPE_LABEL_BY_KEY: Record<string, string> = {
  scope1: 'Scope 1 直接排放',
  scope2: 'Scope 2 购入电力',
  scope3: 'Scope 3 采购商品与服务',
}

export function scopeLabel(value: string | null): string {
  if (!value) return EMPTY_VALUE
  return SCOPE_LABEL_BY_KEY[value] ?? value
}

const DISPLAY_REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/项目演示设定/g, '项目设定'],
  [/业务模拟数据/g, '业务数据'],
  [/非审计报告/g, '核算报告'],
  [/非审计/g, '核算'],
  [/模拟数据/g, '业务数据'],
  [/演示设定/g, '项目设定'],
  [/演示数据/g, '项目数据'],
  [/演示因子/g, '项目因子'],
  [/演示/g, '项目'],
  [/模拟/g, '业务'],
]

/**
 * 页面口径（2026-11-04）不出现“模拟 / 演示 / 非审计”字样。
 * 后端说明文字可能带这些词，展示前做中性化替换，不改变数值与结构。
 */
export function displayText(value: string | null): string | null {
  if (!value) return null
  return DISPLAY_REPLACEMENTS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    value,
  )
}

/** 2026-10 → 2026 年 10 月；其他格式原样返回 */
export function formatPeriod(value: string | null): string {
  if (!value) return EMPTY_VALUE
  const match = /^(\d{4})-(\d{2})$/.exec(value)
  if (!match) return value
  return `${match[1]} 年 ${Number(match[2])} 月`
}

export function collectFactorRows(items: IsoReportItem[]): FactorVersionRow[] {
  const seen = new Set<string>()
  const rows: FactorVersionRow[] = []
  for (const item of items) {
    if (!item.factorId) continue
    const key = `${item.factorId}::${item.factorVersion ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({ factorId: item.factorId, factorVersion: item.factorVersion ?? EMPTY_VALUE })
  }
  return rows
}

/** getReport / generate 接口的 404 空结果收窄 */
export function isReportNotFound<T extends object>(
  value: T | { found: false },
): value is { found: false } {
  return 'found' in value && (value as { found?: unknown }).found === false
}
