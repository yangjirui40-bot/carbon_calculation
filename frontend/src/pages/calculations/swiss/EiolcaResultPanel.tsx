import type { ReactNode } from 'react'
import type { EChartsOption } from 'echarts'
import type { EIOLCAResultData, EngineResponse } from '../../../api/types'
import BaseChart from '../../../components/charts/BaseChart'
import { SwissStat, SwissTable } from '../../../components/swiss'
import type { SwissTableColumn } from '../../../components/swiss'
import { getSwissAxisStyle, getSwissChartPalette } from '../../../utils/chartTheme'
import {
  formatAmount,
  formatDateTime,
  formatEmission,
  formatEmissionWithTonnes,
  formatNumber,
  formatPercent,
} from '../../../utils/format'
import { sectorLabel } from '../labels'
import './EiolcaResultPanel.css'

type EiolcaResultPanelProps = {
  response: EngineResponse<EIOLCAResultData>
}

const COLUMNS: SwissTableColumn[] = [
  { key: 'sector', title: '部门' },
  { key: 'purchase', title: '采购金额', align: 'right' },
  { key: 'emissions', title: '排放量 (kgCO₂e)', align: 'right' },
  { key: 'share', title: '占比', align: 'right' },
]

function readDiagnostic(
  diagnostics: Record<string, unknown>,
  key: string,
): number | null {
  const value = diagnostics[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** EIO-LCA 结果：总排放、部门贡献图 + 表、矩阵诊断与参数说明。 */
export default function EiolcaResultPanel({ response }: EiolcaResultPanelProps) {
  const data = response.data
  const sectors = Array.isArray(data.sectors) ? data.sectors : []
  const emissionsBySector = data.sector_emissions_kgco2e ?? {}
  const emissions = sectors.map((sector) => {
    const value = emissionsBySector[sector]
    return typeof value === 'number' ? value : 0
  })
  const total = typeof data.total_kgco2e === 'number' ? data.total_kgco2e : null
  const diagnostics = data.diagnostics ?? {}

  const labels = sectors.map(sectorLabel)
  const topIndex = emissions.reduce(
    (best, value, index) => (value > (emissions[best] ?? 0) ? index : best),
    0,
  )
  const topValue = emissions[topIndex] ?? 0
  const topShare = total !== null && total > 0 ? topValue / total : 0

  const palette = getSwissChartPalette()
  const axis = getSwissAxisStyle()
  const chartOption: EChartsOption = {
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
      data: [...labels].reverse(),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: axis.axisLabel,
      splitLine: { show: false },
    },
    series: [
      {
        name: '排放量',
        type: 'bar',
        data: [...emissions].reverse(),
        barMaxWidth: 22,
        itemStyle: { color: palette.accent },
      },
    ],
  }

  const rows = sectors.map<Record<string, ReactNode>>((sector, index) => {
    const value = emissions[index] ?? 0
    return {
      id: sector,
      sector: sectorLabel(sector),
      purchase: (
        <span className="eiolca-num">{formatAmount(data.y_cny?.[index] ?? null)}</span>
      ),
      emissions: <span className="eiolca-num">{formatEmission(value)}</span>,
      share: (
        <span className="eiolca-num">
          {formatPercent(total !== null && total > 0 ? value / total : 0)}
        </span>
      ),
    }
  })

  return (
    <div className="eiolca-result">
      <div className="eiolca-result__head">
        <div>
          <div className="eiolca-result__label">总排放 / Total emissions</div>
          <div className="eiolca-result__total">
            {formatEmissionWithTonnes(total)}
          </div>
        </div>
        <div className="eiolca-result__meta">
          <span>模型 {data.model || 'EIO-LCA'}</span>
          <span>生成于 {formatDateTime(response.generated_at)}</span>
        </div>
      </div>

      <div className="eiolca-result__body">
        <div className="eiolca-result__chart">
          <BaseChart
            option={chartOption}
            ariaLabel="EIO-LCA 各部门排放贡献柱状图"
            height={240}
            isEmpty={sectors.length === 0}
            emptyText="暂无部门排放数据"
          />
        </div>

        <div className="eiolca-result__table">
          <SwissTable
            columns={COLUMNS}
            rows={rows}
            rowKey={(row) => String(row.id)}
            empty="暂无部门排放数据"
          />
        </div>
      </div>

      <p className="eiolca-result__summary">
        {total !== null && total > 0
          ? `最大贡献部门为${labels[topIndex] ?? '—'}，排放 ${formatEmission(topValue)} kgCO₂e，占总排放 ${formatPercent(topShare)}。`
          : '本次计算的部门排放均为 0，请检查采购金额。'}
      </p>

      <div className="eiolca-diagnostics">
        <SwissStat
          label="I−A 行列式"
          value={formatNumber(readDiagnostic(diagnostics, 'det_I_minus_A'), 4)}
          hint="det(I − A)"
        />
        <SwissStat
          label="条件数"
          value={formatNumber(readDiagnostic(diagnostics, 'condition_number'), 4)}
          hint="condition number"
        />
        <SwissStat
          label="谱半径"
          value={formatNumber(readDiagnostic(diagnostics, 'spectral_radius_A'), 4)}
          hint="spectral radius ρ(A)"
        />
      </div>

      <p className="eiolca-result__note">
        投入产出矩阵与强度为项目参数；部门排放按采购金额与对应排放强度计算。
      </p>
    </div>
  )
}
