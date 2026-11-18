import type { EChartsOption, LineSeriesOption } from 'echarts'
import { useMemo } from 'react'
import type { DashboardTrend } from '../../../api/types'
import BaseChart from '../../../components/charts/BaseChart'
import SwissEmpty from '../../../components/swiss/SwissEmpty'
import SwissSection from '../../../components/swiss/SwissSection'
import SwissTable, { type SwissTableColumn } from '../../../components/swiss/SwissTable'
import {
  getSwissAxisStyle,
  getSwissChartPalette,
} from '../../../utils/chartTheme'
import { formatEmission, formatNumber } from '../../../utils/format'
import { CHART_HEIGHT } from './labels'

type TrendSectionProps = {
  trend: DashboardTrend
}

const COLUMNS: SwissTableColumn[] = [
  { key: 'period', title: '期间' },
  { key: 'kind', title: '类型' },
  { key: 'total', title: '总排放 (kgCO₂e)', align: 'right' },
  { key: 'target', title: '目标线 (kgCO₂e)', align: 'right' },
]

function buildOption(trend: DashboardTrend): EChartsOption {
  const palette = getSwissChartPalette()
  const axis = getSwissAxisStyle()

  const periods = [
    ...trend.historical.map((point) => point.period),
    ...trend.forecast.map((point) => point.period),
  ]
  const targetLine =
    trend.target_line.length === periods.length
      ? trend.target_line
      : periods.map(() => trend.target_total_kgco2e)

  const historicalData: Array<number | null> = [
    ...trend.historical.map((point) => point.total),
    ...trend.forecast.map(() => null),
  ]

  const forecastData: Array<number | null> = trend.historical.length
    ? [
        ...trend.historical.map((point, index) =>
          index === trend.historical.length - 1 ? point.total : null,
        ),
        ...trend.forecast.map((point) => point.total),
      ]
    : trend.forecast.map((point) => point.total)

  const series: LineSeriesOption[] = [
    {
      name: '历史排放',
      type: 'line',
      data: historicalData,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { width: 2, color: palette.accent },
      itemStyle: { color: palette.accent },
      emphasis: { focus: 'series' },
    },
  ]

  if (trend.forecast.length > 0) {
    series.push({
      name: '预测排放',
      type: 'line',
      data: forecastData,
      symbol: 'emptyCircle',
      symbolSize: 5,
      lineStyle: { width: 2, type: 'dashed', color: palette.warn },
      itemStyle: { color: palette.warn },
      emphasis: { focus: 'series' },
    })
  }

  series.push({
    name: '减排目标线',
    type: 'line',
    data: targetLine,
    symbol: 'none',
    lineStyle: { width: 1, type: 'dashed', color: palette.fail },
    itemStyle: { color: palette.fail },
    silent: true,
  })

  return {
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value) => `${formatEmission(Number(value))} kgCO₂e`,
    },
    legend: {
      top: 0,
      icon: 'roundRect',
      itemWidth: 10,
      itemHeight: 2,
      itemGap: 18,
      textStyle: { color: palette.muted, fontSize: 10 },
    },
    grid: { left: 4, right: 40, top: 36, bottom: 4, containLabel: true },
    xAxis: {
      type: 'category',
      data: periods,
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
        formatter: (value: number) => formatNumber(value, 0),
      },
      splitLine: axis.splitLine,
    },
    series,
  }
}

/** 趋势：历史 + 预测 + 减排目标线，附逐期数据表 */
export default function TrendSection({ trend }: TrendSectionProps) {
  const option = useMemo(() => buildOption(trend), [trend])
  const hasHistory = trend.historical.length > 0

  const targetAt = (index: number) =>
    trend.target_line[index] ?? trend.target_total_kgco2e

  const rows = [
    ...trend.historical.map((point, index) => ({
      key: `history-${point.period}-${index}`,
      period: point.period,
      kind: '历史',
      total: <span className="num">{formatEmission(point.total)}</span>,
      target: <span className="num">{formatEmission(targetAt(index))}</span>,
    })),
    ...trend.forecast.map((point, index) => ({
      key: `forecast-${point.period}-${index}`,
      period: point.period,
      kind: '预测',
      total: <span className="num">{formatEmission(point.total)}</span>,
      target: (
        <span className="num">
          {formatEmission(targetAt(trend.historical.length + index))}
        </span>
      ),
    })),
  ]

  const lastHistory = trend.historical[trend.historical.length - 1]
  const lastForecast = trend.forecast[trend.forecast.length - 1]

  const ariaLabel = hasHistory
    ? `排放趋势折线图。历史期间 ${trend.historical
        .map((point) => `${point.period} ${formatEmission(point.total)} 千克二氧化碳当量`)
        .join('；')}。${
        trend.forecast.length
          ? `未来 ${trend.forecast.length} 个月预测，${lastForecast.period} 为 ${formatEmission(lastForecast.total)} 千克二氧化碳当量。`
          : '预测尚未生成。'
      }目标线 ${formatEmission(trend.target_total_kgco2e)} 千克二氧化碳当量。下方数据表列出相同数据。`
    : '排放趋势暂无数据。'

  return (
    <SwissSection
      kicker="Trend"
      title="排放趋势"
      extra="历史 + 6 个月预测 + 目标线"
    >
      {hasHistory ? (
        <>
          <BaseChart option={option} ariaLabel={ariaLabel} height={CHART_HEIGHT} />

          {trend.forecast.length > 0 ? (
            <p className={`dash-warning ${trend.exceed_warning ? 'is-fail' : 'is-ok'}`}>
              <strong>{trend.exceed_warning ? '注意' : '提示'}</strong>
              {trend.exceed_warning
                ? `预测期内将超过目标线（${formatEmission(trend.target_total_kgco2e)} kgCO₂e）。`
                : `预测期内保持在目标线（${formatEmission(trend.target_total_kgco2e)} kgCO₂e）以下。`}
            </p>
          ) : (
            <p className="dash-warning is-muted">
              历史期间不足两个，暂未生成预测；目标线为{' '}
              {formatEmission(trend.target_total_kgco2e)} kgCO₂e。
            </p>
          )}

          <p className="dash-card__note">
            {lastHistory
              ? `最近期间 ${lastHistory.period} 总排放 ${formatEmission(lastHistory.total)} kgCO₂e。`
              : '暂无历史期间。'}
            {lastForecast
              ? ` 预测第 ${trend.forecast.length} 个月为 ${formatEmission(lastForecast.total)} kgCO₂e。`
              : ''}
          </p>

          <div className="dash-table-block">
            <h3 className="dash-table-caption">逐期数据</h3>
            <div role="group" aria-label="逐期排放与目标线数据表">
              <SwissTable
                columns={COLUMNS}
                rows={rows}
                rowKey={(row) => String(row.key)}
              />
            </div>
          </div>
        </>
      ) : (
        <SwissEmpty
          title="暂无趋势数据"
          description="先完成至少一次企业核算，这里会显示历史排放、预测与目标线。"
        />
      )}
    </SwissSection>
  )
}
