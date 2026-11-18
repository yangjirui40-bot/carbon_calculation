/** 因子库页的显示映射与选项；后端字段值保持 snake_case。 */

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

export const FACTOR_SCOPE_OPTIONS = [
  { value: 'scope1', label: 'Scope 1' },
  { value: 'scope2', label: 'Scope 2' },
  { value: 'scope3', label: 'Scope 3' },
]

/** 页面统一口径：项目因子 / 官方因子（不在页面使用后端 is_demo 的原始措辞） */
export function caliberLabel(isDemo: boolean): string {
  return isDemo ? '项目因子' : '官方因子'
}

/**
 * 来源展示：后端部分种子数据的 origin 含“项目演示设定”等内部措辞，
 * 页面按项目规则不出现“演示/模拟/非审计”，这里只做展示层清理，不回写数据。
 */
export function displayOrigin(origin: string | null | undefined, isDemo: boolean): string {
  const cleaned = (origin ?? '').replace(/演示|模拟|非审计/g, '').trim()
  if (cleaned) return cleaned
  return isDemo ? '项目设定' : '—'
}
