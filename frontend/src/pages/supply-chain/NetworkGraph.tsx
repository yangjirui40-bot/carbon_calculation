import type { EChartsOption } from 'echarts'
import { useMemo } from 'react'
import type {
  HeatmapResponse,
  RiskLevel,
  SupplyChainNetwork,
} from '../../api/types'
import BaseChart from '../../components/charts/BaseChart'
import {
  getSwissChartPalette,
  type SwissChartPalette,
} from '../../utils/chartTheme'
import { formatNumber } from '../../utils/format'
import { INTENSITY_UNIT, RISK_LABELS, tierLabel } from './constants'

type NetworkGraphProps = {
  network: SupplyChainNetwork
  heatmap: HeatmapResponse
  onSelect?: (id:string) => void
}

function riskColor(level: RiskLevel, palette: SwissChartPalette): string {
  if (level === 'red') return palette.fail
  if (level === 'yellow') return palette.warn
  if (level === "unknown") return palette.muted
  return palette.s2
}

/** 供应链网络拓扑：本企业用深绿，供应商按传播风险红/黄/绿着色 */
export default function NetworkGraph({ network, heatmap, onSelect }: NetworkGraphProps) {
  const option = useMemo<EChartsOption>(() => {
    const palette = getSwissChartPalette()
    const heatById = new Map(heatmap.nodes.map((node) => [node.id, node]))
    const nodeById = new Map(network.nodes.map((node) => [node.id, node]))

    const levels = [...new Set(network.nodes.map((node) => node.tier))].sort((a,b) => a-b)
    const levelNodes = levels.map((tier) => network.nodes.filter((node) => node.tier===tier))
    const positions = new Map(levelNodes.flatMap((nodes, level) => nodes.map((node, index) => [
      node.id, { x:level*220, y:nodes.length===1 ? 160 : index*300/(nodes.length-1) },
    ] as const)))

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          const item = Array.isArray(params) ? params[0] : params
          const raw = item.data as { id?: string } | undefined
          const node = raw?.id ? nodeById.get(raw.id) : undefined
          if (!node) return ''
          const heat = heatById.get(node.id)
          const safeName = node.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
          const lines = [safeName, tierLabel(node.tier)]
          if (heat) {
            lines.push(
              `传播碳强度 ${formatNumber(heat.propagated_intensity, 3)} ${INTENSITY_UNIT}`,
            )
            lines.push(
              `风险 ${RISK_LABELS[heat.risk_level]}${heat.estimated ? '（估算值）' : ''}`,
            )
          }
          return lines.join('<br/>')
        },
      },
      series: [
        {
          type: 'graph',
          layout: 'none',
          left: 40, right: 48, top: 26, bottom: 36,
          roam: true,
          symbol: 'circle',
          edgeSymbol: ['none', 'arrow'],
          edgeSymbolSize: 7,
          categories: [{ name: '本企业' }, { name: '供应商' }],
          label: {
            show: true,
            position: 'bottom',
            width: 108, overflow: 'truncate',
            formatter: (params) => params.name.replace(/（模拟(演示)?）$/, ''),
            color: palette.ink,
            fontSize: 10,
          },
          lineStyle: { color: palette.muted, opacity: .55, width: 1, curveness: 0.07 },
          emphasis: { focus: 'adjacency', lineStyle: { width: 2 } },
          data: network.nodes.map((node) => {
            const heat = heatById.get(node.id)
            const color =
              node.type === 'company'
                ? palette.accent
                : heat
                  ? riskColor(heat.risk_level, palette)
                  : palette.muted
            return {
              id: node.id,
              name: node.name,
              ...positions.get(node.id),
              category: node.type === 'company' ? 0 : 1,
              symbolSize: node.type === 'company' ? 25 : 16,
              itemStyle: { color },
            }
          }),
          links: network.edges.map((edge) => ({
            source: edge.source_id,
            target: edge.target_id,
          })),
        },
      ],
    }
  }, [network, heatmap])

  const riskNodes = heatmap.nodes.filter((node) => node.risk_level !== 'green')
  const ariaLabel = [
    `供应链网络拓扑图，共 ${network.nodes.length} 个节点、${network.edges.length} 条关系。`,
    riskNodes.length > 0
      ? `非低风险节点：${riskNodes
          .map((node) => `${node.name}（${RISK_LABELS[node.risk_level]}）`)
          .join('、')}。`
      : '全部节点为低风险。',
    '可缩放图形，上方热力图可查看供应商详情。',
  ].join('')

  return <BaseChart option={option} ariaLabel={ariaLabel} height={380} onItemClick={(data, kind) => {
    if (kind === 'node' && data && typeof data === 'object' && 'id' in data && typeof data.id === 'string'
      && heatmap.nodes.some((node) => node.id===data.id)) onSelect?.(data.id)
  }} />
}
