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
  compact?: boolean
  onSelect: (scope: string, category?: string) => void
}

type ActiveFlow = DashboardSankey['links'][number]

const COLUMNS: SwissTableColumn[] = [
  { key: 'source', title: '来源' },
  { key: 'target', title: '去向' },
  { key: 'value', title: '排放 (kgCO₂e)', align: 'right' },
]

function nodeColor(name: string, palette: SwissChartPalette): string {
  if (name === '外购电力') return palette.s2
  if (name === '柴油燃烧') return palette.s1
  if (name === '外购商品与服务') return palette.s3
  if (name === '范围1 直接排放') return palette.s1
  if (name === '范围2 能源间接排放') return palette.s2
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
        links: flows,
      },
    ],
  }
}

/** 排放流向：能源与采购输入 → 生产环节 → 三大范围，附流向明细表 */
export default function SankeySection({ sankey, compact = false, onSelect }: SankeySectionProps) {
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
    source: flow.scope ? <button type="button" className="dash-flow-link" onClick={() => onSelect(flow.scope!, flow.category)}>
      {flow.source}
    </button> : flow.source,
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
    <SwissSection title="排放流向 · 桑基图" extra="业务来源 → 排放范围">
      {flows.length > 0 ? (
        <>
          <BaseChart option={option} ariaLabel={ariaLabel} height={compact ? 222 : CHART_HEIGHT}
            onItemClick={(data, kind) => {
              if (kind === 'edge' && data && typeof data === 'object' && 'scope' in data && typeof data.scope === 'string') {
                onSelect(data.scope, 'category' in data && typeof data.category === 'string' ? data.category : undefined)
              }
            }} />
          <p className="dash-card__note">
            点流带或明细可查参与核算的记录。共 {flows.length} 条流向。
          </p>
          <details className="dash-table-block dash-data" open={compact ? undefined : true}>
            <summary>查看流向明细</summary>
            <div role="group" aria-label="排放流向明细数据表">
              <SwissTable
                columns={COLUMNS}
                rows={rows}
                rowKey={(row) => String(row.key)}
              />
            </div>
          </details>
        </>
      ) : (
        <SwissEmpty
          title="暂无排放流向"
          description="完成一次企业核算后，这里会显示业务类别到排放范围的实际核算流向。"
        />
      )}
    </SwissSection>
  )
}
