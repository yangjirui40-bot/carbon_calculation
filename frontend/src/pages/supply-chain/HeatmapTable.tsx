import type { HeatmapNode } from '../../api/types'
import SwissTable, {
  type SwissTableColumn,
} from '../../components/swiss/SwissTable'
import { formatNumber } from '../../utils/format'
import RiskBadge from './RiskBadge'
import { tierLabel } from './constants'
import './shared.css'

const COLUMNS: SwissTableColumn[] = [
  { key: 'name', title: '名称' },
  { key: 'tier', title: '层级', width: 110 },
  { key: 'intensity', title: '传播碳强度', width: 132, align: 'right' },
  { key: 'estimated', title: '是否估算', width: 92, align: 'center' },
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
    estimated: node.estimated ? '是' : '否',
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
