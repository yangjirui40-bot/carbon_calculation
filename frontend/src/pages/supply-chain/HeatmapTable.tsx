import type { HeatmapNode } from '../../api/types'
import SwissTable, {
  type SwissTableColumn,
} from '../../components/swiss/SwissTable'
import { formatDateTime, formatNumber } from '../../utils/format'
import RiskBadge from './RiskBadge'
import { tierLabel } from './constants'
import './shared.css'

const COLUMNS: SwissTableColumn[] = [
  { key: 'name', title: '供应商' },
  { key: 'industry', title: '行业 / 地区' },
  { key: 'tier', title: '层级', width: 110 },
  { key: 'intensity', title: '传播碳强度', width: 132, align: 'right' },
  { key: 'estimated', title: '数据来源', width: 110 },
  { key: 'updated', title: '档案更新时间', width: 120 },
  { key: 'risk', title: '风险等级', width: 150 },
]

/** 热力节点表：传播碳强度与风险等级，与网络拓扑同源 */
export default function HeatmapTable({ nodes }: { nodes: HeatmapNode[] }) {
  const rows = nodes.map((node) => ({
    _key: node.id,
    name: (
      <span className="sc-cell-name">
        {node.name}
        {node.type === 'company' ? <span className="sc-tag">本企业</span> : null}
      </span>
    ),
    tier: tierLabel(node.tier),
    intensity: <span className="num">{formatNumber(node.propagated_intensity, 3)}</span>,
    industry: [node.industry, node.region].filter(Boolean).join(' / ') || '—',
    estimated: node.propagated_intensity === null ? '缺数据' : node.estimated ? '邻接估算' : '填报强度',
    updated: formatDateTime(node.updated_at),
    risk: <RiskBadge level={node.risk_level} />,
  }))

  return (
    <SwissTable
      columns={COLUMNS}
      rows={rows}
      rowKey={(row) => String(row._key)}
      empty="暂无热力节点"
    />
  )
}
