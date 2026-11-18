/** 把后端 run.result（Record<string, unknown>）解析成结果页可安全渲染的视图模型。 */

export interface EnterpriseResultItem {
  recordId: string
  category: string
  scope: string
  amount: number | null
  unit: string
  factorId: string
  factorVersion: string
  emissions: number
}

export interface EnterpriseResultView {
  totalKg: number
  period: string | null
  scope1: number
  scope2: number
  scope3: number
  items: EnterpriseResultItem[]
  factorVersions: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function parseEnterpriseResult(
  result: Record<string, unknown> | null,
): EnterpriseResultView | null {
  if (!result) return null

  const totalKg = toNumber(result.total_kgco2e)
  if (totalKg === null) return null

  const breakdown = isRecord(result.scope_breakdown) ? result.scope_breakdown : {}
  const rawItems = Array.isArray(result.items) ? result.items : []
  const items = rawItems.filter(isRecord).map<EnterpriseResultItem>((item) => ({
    recordId: toText(item.record_id),
    category: toText(item.category),
    scope: toText(item.scope),
    amount: toNumber(item.activity_or_amount),
    unit: toText(item.basis_unit),
    factorId: toText(item.factor_id),
    factorVersion: toText(item.factor_version),
    emissions: toNumber(item.emissions_kgco2e) ?? 0,
  }))

  const rawVersions = Array.isArray(result.factor_versions) ? result.factor_versions : []
  const factorVersions = rawVersions.filter(
    (version): version is string => typeof version === 'string',
  )

  return {
    totalKg,
    period: typeof result.period === 'string' ? result.period : null,
    scope1: toNumber(breakdown.scope1) ?? 0,
    scope2: toNumber(breakdown.scope2) ?? 0,
    scope3: toNumber(breakdown.scope3) ?? 0,
    items,
    factorVersions,
  }
}
