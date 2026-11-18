import type { EChartsOption } from 'echarts'
import { useMemo } from 'react'
import type { SupplierSubmissionRecord } from '../../../api/types'
import BaseChart from '../../../components/charts/BaseChart'
import { SwissEmpty } from '../../../components/swiss'
import {
  getSwissAxisStyle,
  getSwissChartPalette,
} from '../../../utils/chartTheme'
import { formatNumber } from '../../../utils/format'

type SubmissionTrendProps = {
  submissions: SupplierSubmissionRecord[]
}

type TrendPoint = {
  period: string
  total: number
}

/** 同一期间多次上报时累加，按期间升序形成单点或折线 */
function toTrendPoints(records: SupplierSubmissionRecord[]): TrendPoint[] {
  const totals = new Map<string, number>()
  for (const record of records) {
    totals.set(
      record.period,
      (totals.get(record.period) ?? 0) + record.reported_emissions,
    )
  }
  return [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([period, total]) => ({ period, total }))
}

function formatAxisValue(value: number): string {
  if (Math.abs(value) >= 1) return formatNumber(value, 0)
  return String(Number(value.toFixed(4)))
}

function buildOption(points: TrendPoint[]): EChartsOption {
  const palette = getSwissChartPalette()
  const axis = getSwissAxisStyle()

  return {
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value) => `${formatNumber(Number(value), 2)} kgCO₂e`,
    },
    grid: { left: 4, right: 32, top: 24, bottom: 4, containLabel: true },
    xAxis: {
      type: 'category',
      data: points.map((point) => point.period),
      boundaryGap: false,
      axisLine: axis.axisLine,
      axisTick: { show: false },
      axisLabel: { ...axis.axisLabel, fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      min: 0,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        ...axis.axisLabel,
        fontSize: 10,
        formatter: (value: number) => formatAxisValue(value),
      },
      splitLine: axis.splitLine,
    },
    series: [
      {
        name: '上报排放量',
        type: 'line',
        data: points.map((point) => point.total),
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2, color: palette.accent },
        itemStyle: { color: palette.accent },
        emphasis: { focus: 'series' },
      },
    ],
  }
}

function buildAriaLabel(points: TrendPoint[]): string {
  return `上报排放量趋势折线图。${points
    .map(
      (point) =>
        `${point.period} 为 ${formatNumber(point.total, 2)} 千克二氧化碳当量`,
    )
    .join('；')}。`
}

/** 期间趋势：只画上报排放量，不涉及历史配额 */
export default function SubmissionTrend({ submissions }: SubmissionTrendProps) {
  const points = useMemo(() => toTrendPoints(submissions), [submissions])
  const option = useMemo(() => buildOption(points), [points])

  if (points.length === 0) {
    return (
      <SwissEmpty
        title="暂无上报数据"
        description="提交一次碳数据填报后，这里会显示上报排放量随期间的变化。"
      />
    )
  }

  return (
    <BaseChart option={option} ariaLabel={buildAriaLabel(points)} height={250} />
  )
}
