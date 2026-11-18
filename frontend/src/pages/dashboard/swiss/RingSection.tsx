import type { EChartsOption } from 'echarts'
import { useMemo } from 'react'
import type { DashboardRing } from '../../../api/types'
import BaseChart from '../../../components/charts/BaseChart'
import SwissEmpty from '../../../components/swiss/SwissEmpty'
import SwissSection from '../../../components/swiss/SwissSection'
import {
  getSwissAxisStyle,
  getSwissChartPalette,
} from '../../../utils/chartTheme'
import { formatEmission, formatNumber, formatPercent } from '../../../utils/format'
import { categoryLabel, CHART_HEIGHT, scopeColor } from './labels'

type RingSectionProps = {
  ring: DashboardRing
  total: number
}

type RingCategory = DashboardRing['categories'][number]

type RingOptions = {
  scopeOption: EChartsOption
  categoryOption: EChartsOption
  scopeAria: string
}

/**
 * 类别聚合接口可能按明细行返回同一类别多次；这里只去重展示，
 * 数值仍取后端返回的类别汇总值，不重新计算排放。
 */
function dedupeCategories(categories: RingCategory[]): RingCategory[] {
  const seen = new Set<string>()
  return categories.filter((item) => {
    const key = `${item.scope}|${item.category}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function buildOptions(
  ring: DashboardRing,
  categories: RingCategory[],
): RingOptions {
  const palette = getSwissChartPalette()
  const axis = getSwissAxisStyle()

  const scopeOption: EChartsOption = {
    color: ring.scopes.map((item) => scopeColor(item.scope, palette)),
    tooltip: {
      trigger: 'item',
      valueFormatter: (value) => `${formatEmission(Number(value))} kgCO₂e`,
    },
    legend: {
      bottom: 0,
      icon: 'square',
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 14,
      textStyle: { color: palette.muted, fontSize: 10 },
    },
    series: [
      {
        type: 'pie',
        radius: ['52%', '72%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        label: { show: false },
        labelLine: { show: false },
        itemStyle: {
          borderColor: palette.paper,
          borderWidth: 2,
        },
        emphasis: { scale: true, scaleSize: 4 },
        data: ring.scopes.map((item) => ({
          name: item.name,
          value: item.emissions_kgco2e,
        })),
      },
    ],
  }

  const categoryOption: EChartsOption = {
    tooltip: {
      trigger: 'item',
      valueFormatter: (value) => `${formatEmission(Number(value))} kgCO₂e`,
    },
    grid: { left: 4, right: 64, top: 12, bottom: 4, containLabel: true },
    xAxis: {
      type: 'value',
      axisLine: axis.axisLine,
      axisTick: { show: false },
      axisLabel: {
        ...axis.axisLabel,
        fontSize: 10,
        formatter: (value: number) => formatNumber(value, 0),
      },
      splitLine: axis.splitLine,
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: categories.map((item) => categoryLabel(item.category)),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: palette.muted, fontSize: 10 },
      splitLine: { show: false },
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 20,
        data: categories.map((item) => ({
          value: item.emissions_kgco2e,
          itemStyle: { color: scopeColor(item.scope, palette) },
        })),
        label: {
          show: true,
          position: 'right',
          color: palette.muted,
          fontSize: 10,
          formatter: (params: { value?: unknown }) =>
            formatNumber(Number(params.value), 0),
        },
      },
    ],
  }

  const scopeAria = `排放结构环形图。${ring.scopes
    .map(
      (item) =>
        `${item.name} ${formatEmission(item.emissions_kgco2e)} 千克二氧化碳当量，占比 ${formatPercent(item.ratio)}`,
    )
    .join('；')}。下方数据表列出相同数据。`

  return { scopeOption, categoryOption, scopeAria }
}

/** 排放结构：Scope 环形图 + 业务类别横向条形图，各自附数据表 */
export default function RingSection({ ring, total }: RingSectionProps) {
  const categories = useMemo(
    () => dedupeCategories(ring.categories),
    [ring.categories],
  )
  const options = useMemo(
    () => buildOptions(ring, categories),
    [ring, categories],
  )

  const hasScopes = ring.scopes.some((item) => item.emissions_kgco2e > 0)
  const hasCategories = categories.some((item) => item.emissions_kgco2e > 0)

  const topScope = [...ring.scopes].sort(
    (a, b) => b.emissions_kgco2e - a.emissions_kgco2e,
  )[0]
  const topCategory = [...categories].sort(
    (a, b) => b.emissions_kgco2e - a.emissions_kgco2e,
  )[0]

  return (
    <SwissSection
      kicker="Distribution"
      title="排放结构"
      extra={`单位 kgCO₂e · ${formatEmission(total)} kgCO₂e`}
    >
      <div className="dash-duo">
        <article className="dash-card">
          <header className="dash-card__head">
            <h3>按 Scope</h3>
            <span>{ring.scopes.length} 个范围</span>
          </header>

          {hasScopes ? (
            <>
              <BaseChart
                option={options.scopeOption}
                ariaLabel={options.scopeAria}
                height={CHART_HEIGHT}
              />
              <p className="dash-card__note">
                {topScope && total > 0
                  ? `${topScope.name}占本期 ${formatPercent(topScope.ratio)}，是最大排放来源。`
                  : '暂无排放结构数据。'}
              </p>
              <table className="dash-mini" aria-label="Scope 排放数据">
                <thead>
                  <tr>
                    <th scope="col">范围</th>
                    <th scope="col" className="is-right">
                      排放 (kgCO₂e)
                    </th>
                    <th scope="col" className="is-right">
                      占比
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ring.scopes.map((item) => (
                    <tr key={item.scope}>
                      <td>{item.name}</td>
                      <td className="is-right num">
                        {formatEmission(item.emissions_kgco2e)}
                      </td>
                      <td className="is-right num">{formatPercent(item.ratio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <SwissEmpty
              title="暂无 Scope 分布"
              description="完成一次企业核算后，这里会显示各范围的占比。"
            />
          )}
        </article>

        <article className="dash-card">
          <header className="dash-card__head">
            <h3>按业务类别</h3>
            <span>{categories.length} 个类别</span>
          </header>

          {hasCategories ? (
            <>
              <BaseChart
                option={options.categoryOption}
                ariaLabel="业务类别排放横向条形图，数据表见下方。"
                height={CHART_HEIGHT}
              />
              <p className="dash-card__note">
                {topCategory
                  ? `共 ${categories.length} 个业务类别，${categoryLabel(topCategory.category)}排放最高。`
                  : '暂无类别数据。'}
              </p>
              <table className="dash-mini" aria-label="业务类别排放数据">
                <thead>
                  <tr>
                    <th scope="col">类别</th>
                    <th scope="col">所属范围</th>
                    <th scope="col" className="is-right">
                      排放 (kgCO₂e)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((item) => (
                    <tr key={`${item.scope}-${item.category}`}>
                      <td>{categoryLabel(item.category)}</td>
                      <td>{item.scope.replace('scope', 'Scope ')}</td>
                      <td className="is-right num">
                        {formatEmission(item.emissions_kgco2e)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <SwissEmpty
              title="暂无类别数据"
              description="完成一次企业核算后，这里会显示类别维度的排放。"
            />
          )}
        </article>
      </div>
    </SwissSection>
  )
}
