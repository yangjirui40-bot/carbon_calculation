import { cssToken } from './cssToken'

/**
 * 瑞士风格图表主题：通过 cssToken 读取 CSS 变量，
 * 与 src/styles/swiss-tokens.css、src/styles/tokens.css 保持同源。
 * 这里的十六进制值只在 CSS 变量不可读（如 SSR/首帧）时兜底。
 */

const SWISS_FALLBACKS = {
  '--paper': '#f1eee5',
  '--ink': '#14211c',
  '--muted': '#6d726a',
  '--rule': '#d3ccbd',
  '--rule-soft': '#e2dccf',
  '--accent': '#0e3b2e',
  '--lime': '#c9f45b',
  '--fail': '#a33a2a',
  '--warn': '#9a5b13',
  '--s1': '#1f4e79',
  '--s2': '#14532d',
  '--s3': '#b45309',
} as const

/** tokens.css 的碳排放强度色阶（绿→红） */
const EMISSION_FALLBACKS = [
  '#1b5e20',
  '#4caf50',
  '#cddc39',
  '#ff9800',
  '#f44336',
  '#b71c1c',
] as const

type SwissTokenName = keyof typeof SWISS_FALLBACKS

function read(name: SwissTokenName): string {
  return cssToken(name, SWISS_FALLBACKS[name])
}

export type SwissChartPalette = {
  paper: string
  ink: string
  muted: string
  rule: string
  ruleSoft: string
  accent: string
  lime: string
  fail: string
  warn: string
  s1: string
  s2: string
  s3: string
  emission: string[]
}

export type SwissAxisStyle = {
  axisLine: { lineStyle: { color: string } }
  axisLabel: { color: string }
  splitLine: { lineStyle: { color: string } }
}

export function getSwissChartPalette(): SwissChartPalette {
  return {
    paper: read('--paper'),
    ink: read('--ink'),
    muted: read('--muted'),
    rule: read('--rule'),
    ruleSoft: read('--rule-soft'),
    accent: read('--accent'),
    lime: read('--lime'),
    fail: read('--fail'),
    warn: read('--warn'),
    s1: read('--s1'),
    s2: read('--s2'),
    s3: read('--s3'),
    emission: EMISSION_FALLBACKS.map((fallback, index) =>
      cssToken(`--emission-${index + 1}`, fallback),
    ),
  }
}

/** 坐标轴线用 --rule，标签用 --muted，网格线用 --rule-soft */
export function getSwissAxisStyle(): SwissAxisStyle {
  return {
    axisLine: { lineStyle: { color: read('--rule') } },
    axisLabel: { color: read('--muted') },
    splitLine: { lineStyle: { color: read('--rule-soft') } },
  }
}
