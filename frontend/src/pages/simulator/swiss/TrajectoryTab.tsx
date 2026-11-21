import { useCallback, useEffect, useMemo, useState } from 'react'
import { simulatorApi } from '../../../api'
import type { TrajectoryResponse } from '../../../api/types'
import BaseChart from '../../../components/charts/BaseChart'
import {
  SwissEmpty,
  SwissError,
  SwissSection,
  SwissStat,
} from '../../../components/swiss'
import type { EChartsOption } from 'echarts'
import { getSwissAxisStyle, getSwissChartPalette } from '../../../utils/chartTheme'
import { formatEmission } from '../../../utils/format'
import { errorMessage } from '../../products/labels'
import './TrajectoryTab.css'

type TrajectoryTabProps = {
  companyId: number
}

/** 轨迹：BAU 基准线与各情景干预线对比，含未来 6 期预测。 */
export default function TrajectoryTab({ companyId }: TrajectoryTabProps) {
  const [data, setData] = useState<TrajectoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1)
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    simulatorApi
      .getTrajectory(companyId)
      .then((response) => {
        if (active) setData(response)
      })
      .catch((fetchError: unknown) => {
        if (active) {
          setData(null)
          setError(errorMessage(fetchError))
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [companyId, reloadToken])

  const option = useMemo<EChartsOption | null>(() => {
    if (!data) return null
    const palette = getSwissChartPalette()
    const axis = getSwissAxisStyle()
    const lineColors = [palette.accent, palette.s3, palette.s1, palette.s2]

    return {
      grid: { left: 8, right: 16, top: 42, bottom: 8, containLabel: true },
      tooltip: {
        trigger: 'axis',
        backgroundColor: palette.paper,
        borderColor: palette.rule,
        borderWidth: 1,
        padding: [8, 10],
        textStyle: { color: palette.ink, fontSize: 11 },
      },
      legend: {
        top: 0,
        left: 0,
        itemWidth: 16,
        itemHeight: 2,
        textStyle: { color: palette.muted, fontSize: 10.5 },
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: data.labels,
        axisLine: axis.axisLine,
        axisTick: { show: false },
        axisLabel: { ...axis.axisLabel, fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        name: 'kgCO₂e',
        nameTextStyle: { color: palette.muted, fontSize: 10 },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { ...axis.axisLabel, fontSize: 10 },
        splitLine: axis.splitLine,
      },
      series: [
        {
          name: 'BAU 基准线',
          type: 'line',
          showSymbol: false,
          data: data.bau,
          lineStyle: { width: 1.6, type: 'dashed', color: palette.muted },
          itemStyle: { color: palette.muted },
        },
        ...data.interventions.map((item, index) => ({
          name: item.scenario_name,
          type: 'line' as const,
          showSymbol: false,
          data: item.curve,
          lineStyle: {
            width: 1.8,
            color: lineColors[index % lineColors.length],
          },
          itemStyle: { color: lineColors[index % lineColors.length] },
        })),
      ],
    }
  }, [data])

  if (loading) {
    return (
      <div className="trajectory-loading" role="status" aria-busy="true">
        正在加载减排轨迹…
      </div>
    )
  }

  if (error) {
    return <SwissError message={error} onRetry={reload} />
  }

  if (!data || data.labels.length === 0) {
    return (
      <SwissEmpty
        title="暂无轨迹数据"
        description="先确认业务记录并完成一次企业核算后，这里会显示历史与预测轨迹。"
      />
    )
  }

  const summary = data.summary

  return (
    <div className="trajectory-tab">
      <div className="trajectory-stats">
        <SwissStat
          label="当前核算期"
          value={summary.period ?? '—'}
        />
        <SwissStat
          label="本期总排放"
          value={formatEmission(summary.total_kgco2e)}
          unit="kgCO₂e"
          tone="accent"
        />
        <SwissStat
          label="Scope 1"
          value={formatEmission(summary.scope_breakdown.scope1)}
          unit="kgCO₂e"
        />
        <SwissStat
          label="Scope 2"
          value={formatEmission(summary.scope_breakdown.scope2)}
          unit="kgCO₂e"
        />
        <SwissStat
          label="Scope 3"
          value={formatEmission(summary.scope_breakdown.scope3)}
          unit="kgCO₂e"
        />
      </div>

      <SwissSection
        kicker="轨迹"
        title="BAU 与情景干预"
        extra={
          <span>
            历史 {data.historical_count} 期 + 预测 {data.forecast_count} 期 · {data.interventions.length} 个情景
          </span>
        }
      >
        {data.interventions.length === 0 ? (
          <p className="trajectory-note">
            还没有情景干预线。先在“情景”页签运行一次模拟，轨迹会自动叠加对应曲线。
          </p>
        ) : null}
        {option ? (
          <BaseChart option={option} ariaLabel="减排轨迹折线图：BAU 基准线与情景干预线" height={340} />
        ) : null}
      </SwissSection>
    </div>
  )
}
