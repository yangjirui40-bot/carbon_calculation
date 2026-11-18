import type { EChartsOption } from 'echarts'
import { useMemo } from 'react'
import type { DashboardSankey } from '../../../api/types'
import BaseChart from '../../../components/charts/BaseChart'
import SwissEmpty from '../../../components/swiss/SwissEmpty'
import SwissSection from '../../../components/swiss/SwissSection'
import SwissTable, { type SwissTableColumn } from '../../../components/swiss/SwissTable'
import {
  getSwissChartPalette,
  type SwissChartPalette,
} from '../../../utils/chartTheme'
import { formatEmission } from '../../../utils/format'
import { CHART_HEIGHT } from './labels'

type SankeySectionProps = {
  sankey: DashboardSankey
}

type ActiveFlow = {
  source: string
  target: string
  value: number
}

const COLUMNS: SwissTableColumn[] = [
  { key: 'source', title: '来源' },
  { key: 'target', title: '去向' },
  { key: 'value', title: '排放 (kgCO₂e)', align: 'right' },
]

function nodeColor(name: string, palette: SwissChartPalette): string {
  if (name === '电网') return palette.s2
  if (name === '柴油') return palette.s1
  if (name === '外购商品与服务') return palette.s3
  if (name === '范围1 直接排放') return palette.s1
  if (name === '范围2 间接排放') return palette.s2
  if (name === '范围3 价值链排放') return palette.s3
  return palette.muted
}

function buildOption(flows: ActiveFlow[], nodeNames: string[]): EChartsOption {
  const palette = getSwissChartPalette()

  return {
    tooltip: {
      trigger: 'item',
      valueFormatter: (value) => `${formatEmission(Number(value))} kgCO₂e`,
    },
    series: [
      {
        type: 'sankey',
        left: 10,
        right: 100,
        top: 10,
        bottom: 10,
        nodeWidth: 10,
        nodeGap: 14,
        layoutIterations: 0,
        emphasis: { focus: 'adjacency' },
        label: { color: palette.ink, fontSize: 10 },
        lineStyle: { color: 'gradient', opacity: 0.35 },
        data: nodeNames.map((name) => ({
          name,
          itemStyle: { color: nodeColor(name, palette) },
        })),
        links: flows.map((flow) => ({
          source: flow.source,
          target: flow.target,
          value: flow.value,
        })),
      },
    ],
  }
}

/** 排放流向：能源与采购输入 → 生产环节 → 三大范围，附流向明细表 */
export default function SankeySection({ sankey }: SankeySectionProps) {
  const flows = useMemo(
    () => sankey.links.filter((link) => link.value > 0),
    [sankey.links],
  )

  const nodeNames = useMemo(() => {
    const used = new Set<string>()
    flows.forEach((flow) => {
      used.add(flow.source)
      used.add(flow.target)
    })
    return sankey.nodes.map((node) => node.name).filter((name) => used.has(name))
  }, [flows, sankey.nodes])

  const option = useMemo(() => buildOption(flows, nodeNames), [flows, nodeNames])

  const rows = flows.map((flow, index) => ({
    key: `${flow.source}-${flow.target}-${index}`,
    source: flow.source,
    target: flow.target,
    value: <span className="num">{formatEmission(flow.value)}</span>,
  }))

  const ariaLabel = `排放流向桑基图。${flows
    .map(
      (flow) =>
        `${flow.source}到${flow.target} ${formatEmission(flow.value)} 千克二氧化碳当量`,
    )
    .join('；')}。下方流向明细表列出相同数据。`

  return (
    <SwissSection kicker="Flow" title="排放流向" extra="仅显示非零流量 · kgCO₂e">
      {flows.length > 0 ? (
        <>
          <BaseChart option={option} ariaLabel={ariaLabel} height={CHART_HEIGHT} />
          <p className="dash-card__note">
            从左到右依次为能源与采购输入、生产环节、排放范围；共 {flows.length} 条非零流量。
          </p>
          <div className="dash-table-block">
            <h3 className="dash-table-caption">流向明细</h3>
            <div role="group" aria-label="排放流向明细数据表">
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
          title="暂无排放流向"
          description="完成一次企业核算后，这里会显示输入、生产环节与排放范围之间的流向。"
        />
      )}
    </SwissSection>
  )
}
