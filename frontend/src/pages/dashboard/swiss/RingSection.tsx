import type { EChartsOption } from 'echarts'
import { useMemo } from 'react'
import type { DashboardRing } from '../../../api/types'
import BaseChart from '../../../components/charts/BaseChart'
import SwissEmpty from '../../../components/swiss/SwissEmpty'
import SwissSection from '../../../components/swiss/SwissSection'
import { getSwissChartPalette } from '../../../utils/chartTheme'
import { formatEmission, formatPercent } from '../../../utils/format'
import { scopeColor } from './labels'

export default function RingSection({ ring, total, onScope }: {
  ring: DashboardRing
  total: number
  onScope: (scope: string) => void
}) {
  const option = useMemo<EChartsOption>(() => {
    const palette = getSwissChartPalette()
    return {
      tooltip: { trigger: 'item', valueFormatter: (value) => `${formatEmission(Number(value))} kgCO₂e` },
      series: [{
        type: 'pie',
        radius: ['67%', '85%'],
        label: { show: false },
        labelLine: { show: false },
        emphasis: { scaleSize: 3 },
        data: ring.scopes.filter((item) => item.emissions_kgco2e > 0).map((item) => ({
          value: item.emissions_kgco2e,
          name: item.name,
          itemStyle: { color: scopeColor(item.scope, palette) },
        })),
      }],
    }
  }, [ring])
  return (
    <SwissSection title="排放结构" extra="按范围区分">
      {total > 0 ? (
        <>
          <div className="dash-ring">
            <BaseChart option={option} ariaLabel="排放范围占比，具体数据见下方列表" height={180} />
            <div className="dash-ring__center" aria-hidden="true"><strong>{formatEmission(total)}</strong><span>kgCO₂e</span></div>
          </div>
          <div className="dash-scopes">
            {ring.scopes.map((item) => (
              <button type="button" key={item.scope} data-scope={item.scope} onClick={() => onScope(item.scope)}>
                <i aria-hidden="true" /><span>{item.name}</span><b>{formatPercent(item.ratio)}</b>
              </button>
            ))}
          </div>
        </>
      ) : <SwissEmpty title="当前快照暂无排放分布" />}
    </SwissSection>
  )
}
