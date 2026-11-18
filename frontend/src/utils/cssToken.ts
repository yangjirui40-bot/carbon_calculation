/** 读取 tokens.css 里的 CSS 变量，供 ECharts 等需要色值的 JS 使用 */
export function cssToken(name: string, fallback = ''): string {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name)
  return value.trim() || fallback
}
