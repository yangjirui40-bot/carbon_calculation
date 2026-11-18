import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { EChartsOption } from 'echarts'
import { calculationsApi } from '../../../api'
import type { UncertaintyResponse } from '../../../api/types'
import BaseChart from '../../../components/charts/BaseChart'
import {
  SwissEmpty,
  SwissError,
  SwissSection,
  SwissStat,
  SwissTable,
} from '../../../components/swiss'
import type { SwissTableColumn } from '../../../components/swiss'
import { getSwissAxisStyle, getSwissChartPalette } from '../../../utils/chartTheme'
import {
  formatEmission,
  formatNumber,
  formatPercent,
} from '../../../utils/format'
import { errorMessage } from '../text'
import './ResultsUncertainty.css'

type ResultsUncertaintyProps = {
  runId: string
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: UncertaintyResponse }

const COLUMNS: SwissTableColumn[] = [
  { key: 'name', title: '排放项' },
  { key: 'emissions', title: '排放量 (kgCO₂e)', align: 'right' },
  { key: 'uncertainty', title: '不确定度', align: 'right' },
  { key: 'sigma', title: '标准差 σ (kgCO₂e)', align: 'right' },
  { key: 'contribution', title: '方差贡献（累计）', align: 'right' },
]

function shorten(name: string, max = 30): string {
  return name.length > max ? `${name.slice(0, max)}…` : name
}

/** 不确定性分析：置信区间、相对不确定度与敏感性贡献。 */
export default function ResultsUncertainty({ runId }: ResultsUncertaintyProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [token, setToken] = useState(0)

  useEffect(() => {
    let active = true
    setState({ status: 'loading' })
    calculationsApi
      .getUncertainty(runId)
      .then((data) => {
        if (active) setState({ status: 'ready', data })
      })
      .catch((error: unknown) => {
        if (active) setState({ status: 'error', message: errorMessage(error) })
      })
    return () => {
      active = false
    }
  }, [runId, token])

  if (state.status === 'loading') {
    return (
      <SwissSection kicker="不确定性" title="不确定性分析">
        <div className="results-loading" role="status" aria-busy="true">
          正在加载不确定性分析…
        </div>
      </SwissSection>
    )
  }

  if (state.status === 'error') {
    return (
      <SwissSection kicker="不确定性" title="不确定性分析">
        <SwissError
          message={state.message}
          onRetry={() => setToken((value) => value + 1)}
        />
      </SwissSection>
    )
  }

  const { data } = state
  if (data.items.length === 0) {
    return (
      <SwissSection kicker="不确定性" title="不确定性分析">
        <SwissEmpty
          title="没有可分析的明细"
          description="该运行缺少可用于误差传播的排放项。"
        />
      </SwissSection>
    )
  }

  return (
    <SwissSection
      kicker="不确定性"
      title="不确定性分析"
      extra={<span>{data.items.length} 项 · 95% 置信区间</span>}
    >
      <UncertaintyBody data={data} />
    </SwissSection>
  )
}

function UncertaintyBody({ data }: { data: UncertaintyResponse }) {
  const chartOption = useMemo<EChartsOption>(() => {
    const palette = getSwissChartPalette()
    const axis = getSwissAxisStyle()
    const items = data.items
    return {
      backgroundColor: 'transparent',
      grid: { left: 8, right: 28, top: 16, bottom: 8, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: {
        type: 'value',
        axisLine: axis.axisLine,
        axisLabel: axis.axisLabel,
        splitLine: axis.splitLine,
      },
      yAxis: {
        type: 'category',
        data: items.map((item) => shorten(item.name)).reverse(),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: axis.axisLabel,
        splitLine: { show: false },
      },
      series: [
        {
          name: '标准差 σ',
          type: 'bar',
          data: items.map((item) => item.sigma_kgco2e).reverse(),
          barMaxWidth: 20,
          itemStyle: { color: palette.warn },
        },
      ],
    }
  }, [data])

  const rows = data.items.map<Record<string, ReactNode>>((item) => ({
    id: item.name,
    name: item.name,
    emissions: (
      <span className="results-num">{formatEmission(item.emissions_kgco2e)}</span>
    ),
    uncertainty: (
      <span className="results-num">{formatNumber(item.uncertainty_pct, 2)}%</span>
    ),
    sigma: <span className="results-num">{formatEmission(item.sigma_kgco2e)}</span>,
    contribution: (
      <span className="results-num">
        {formatPercent(item.contribution_to_variance)}
      </span>
    ),
  }))

  const top = data.items[0]

  return (
    <div className="results-uncertainty">
      <div className="results-uncertainty__stats">
        <SwissStat
          label="95% 置信区间"
          value={`${formatEmission(data.ci95_low)} — ${formatEmission(data.ci95_high)}`}
          unit="kgCO₂e"
          hint="均值 ±1.96σ"
        />
        <SwissStat
          label="相对不确定度"
          value={formatNumber(data.relative_uncertainty, 2)}
          unit="%"
          hint="σ / 总排放"
        />
        <SwissStat
          label="标准差 σ"
          value={formatEmission(data.sigma_total_kgco2e)}
          unit="kgCO₂e"
          hint="独立误差传播"
        />
      </div>

      <div className="results-uncertainty__chart">
        <BaseChart
          option={chartOption}
          ariaLabel="不确定性各排放项标准差柱状图"
          height={260}
          isEmpty={data.items.length === 0}
          emptyText="暂无不确定性数据"
        />
      </div>

      <p className="results-uncertainty__summary">
        敏感度最高的是 {top.name}，标准差 σ = {formatEmission(top.sigma_kgco2e)}{' '}
        kgCO₂e。
      </p>

      <SwissTable
        columns={COLUMNS}
        rows={rows}
        rowKey={(row, index) => `${String(row.id)}-${index}`}
        empty="暂无不确定性数据"
      />
    </div>
  )
}
