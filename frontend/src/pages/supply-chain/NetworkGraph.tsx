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
}

function riskColor(level: RiskLevel, palette: SwissChartPalette): string {
  if (level === 'red') return palette.fail
  if (level === 'yellow') return palette.warn
  return palette.s2
}

/** 供应链网络拓扑：本企业用深绿，供应商按传播风险红/黄/绿着色 */
export default function NetworkGraph({ network, heatmap }: NetworkGraphProps) {
  const option = useMemo<EChartsOption>(() => {
    const palette = getSwissChartPalette()
    const heatById = new Map(heatmap.nodes.map((node) => [node.id, node]))
    const nodeById = new Map(network.nodes.map((node) => [node.id, node]))

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          const item = Array.isArray(params) ? params[0] : params
          const raw = item.data as { id?: string } | undefined
          const node = raw?.id ? nodeById.get(raw.id) : undefined
          if (!node) return ''
          const heat = heatById.get(node.id)
          const lines = [node.name, tierLabel(node.tier)]
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
          layout: 'force',
          roam: true,
          draggable: true,
          symbol: 'rect',
          edgeSymbol: ['none', 'arrow'],
          edgeSymbolSize: 7,
          categories: [{ name: '本企业' }, { name: '供应商' }],
          force: { repulsion: 320, edgeLength: [90, 160], gravity: 0.08 },
          label: {
            show: true,
            position: 'right',
            color: palette.ink,
            fontSize: 10,
          },
          lineStyle: { color: palette.rule, width: 1, curveness: 0.08 },
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
              category: node.type === 'company' ? 0 : 1,
              symbolSize: node.type === 'company' ? 44 : 30,
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
    '节点可拖动，下方热力节点表列出同一组传播碳强度与风险数据。',
  ].join('')

  return <BaseChart option={option} ariaLabel={ariaLabel} height={380} />
}
