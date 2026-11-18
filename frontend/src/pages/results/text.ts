/** 结果页展示文案（只做翻译与过滤，不含业务计算）。 */

export const OPERATION_LABELS: Record<string, string> = {
  enterprise: '企业核算',
  eiolca: 'EIO-LCA',
  product: '产品碳足迹',
  scenario: '减排情景',
}

export function operationLabel(operation: string | null | undefined): string {
  if (!operation) return '—'
  return OPERATION_LABELS[operation] ?? operation
}

export const RUN_STATUS_LABELS: Record<string, string> = {
  success: '已完成',
  error: '失败',
}

export function runStatusLabel(status: string | null | undefined): string {
  if (!status) return '—'
  return RUN_STATUS_LABELS[status] ?? status
}

/** 页面不展示含“模拟 / 演示 / 非审计”字样的文案（2026-11-04 项目决定）。 */
export function visibleWarnings(warnings: string[] | null | undefined): string[] {
  return (warnings ?? []).filter((warning) => !/模拟|演示|非审计/.test(warning))
}

export function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : '请求失败，请稍后重试'
}

/** 后端 scope 字符串 → “Scope 1” 等展示文本 */
export function scopeLabel(scope: string | null | undefined): string {
  if (!scope) return '—'
  return /^scope[123]$/.test(scope) ? `Scope ${scope.slice(5)}` : scope
}
