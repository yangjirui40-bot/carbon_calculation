import type { EChartsOption } from 'echarts'
import { useMemo } from 'react'
import { Table } from 'antd'
import type { DashboardProduction } from '../../../api/types'
import BaseChart from '../../../components/charts/BaseChart'
import { SwissEmpty, SwissSection } from '../../../components/swiss'
import { scope3Categories } from '../../../config/scope3'
import { formatEmission } from '../../../utils/format'
import { getSwissChartPalette } from '../../../utils/chartTheme'

import { locationKey } from '../monitor'

export function ProductionSection({ production, onLocation }: {
  production: DashboardProduction
  onLocation: (scope: string, organization: string) => void
}) {
  const option = useMemo<EChartsOption>(() => {
    const palette = getSwissChartPalette()
    const labels = new Map(production.sankey.nodes.map((node) => [node.name, node.label]))
    return {
      tooltip: { trigger: 'item', renderMode: 'richText', formatter: (input) => {
        const data = Array.isArray(input) ? input[0] : input
        const link = data.data as { source?: string; target?: string; value?: number }
        return link.source && link.target
          ? `${labels.get(link.source)} → ${labels.get(link.target)}\n${formatEmission(link.value ?? 0)} kgCO₂e`
          : labels.get(data.name) ?? ''
      } },
      series: [{
        type: 'sankey', orient: 'horizontal', left: '3%', right: '26%', top: 18, bottom: 20,
        data: production.sankey.nodes.map((node) => ({
          name: node.name, depth: node.depth, itemStyle: { color: [palette.accent, palette.s2, palette.s3][node.depth] },
        })),
        links: production.sankey.links,
        label: { color: palette.muted, formatter: ({ name }) => labels.get(name) ?? '', width: 106, overflow: 'truncate' },
        lineStyle: { color: 'gradient', opacity: 0.42 },
        nodeWidth: 14, nodeGap: 10, draggable: false, emphasis: { focus: 'adjacency' },
      }],
    }
  }, [production])
  return <SwissSection title="活动 → 车间与产线 → 排放范围" extra="kgCO₂e">
    {Boolean(production.sites?.length) && <details className="dash-data"><summary>按工厂核对排放</summary>
      <Table pagination={false} size="small" dataSource={production.sites}
        rowKey={(row) => `${row.site_id}-${row.scope}`} columns={[
          {title:'工厂',dataIndex:'site_name'}, {title:'范围',dataIndex:'scope'},
          {title:'kgCO₂e',dataIndex:'emissions_kgco2e',render:formatEmission},
        ]}/>
    </details>}
    {production.sankey.links.length > 0
      ? <BaseChart option={option} ariaLabel="活动经车间与产线归入排放范围，逐项数值见下表" height={Math.min(640, Math.max(300, production.sankey.nodes.length * 16))} />
      : <SwissEmpty title="暂无排放流向" description="完成企业核算后查看各车间与产线流向。" />}
    <details className="dash-data" open><summary>按车间和产线查记录</summary>
      <table className="dash-mini"><thead><tr><th>车间</th><th>产线</th><th>范围</th><th>kgCO₂e</th><th>核算依据</th></tr></thead>
        <tbody>{production.locations.map((row) => <tr key={JSON.stringify([row.site_id, row.workshop, row.production_line, row.scope])}>
          <td>{[row.site_name, row.workshop || '未归集车间'].filter(Boolean).join(' / ')}</td><td>{row.production_line || '—'}</td>
          <td>{row.scope.replace('scope', '范围 ')}</td><td>{formatEmission(row.emissions_kgco2e)}</td>
          <td><button type="button" className="bi-record-link" onClick={() => onLocation(row.scope, locationKey(row))}>查看记录</button></td>
        </tr>)}</tbody></table>
    </details>
  </SwissSection>
}

export function Scope3Section({ production }: { production: DashboardProduction }) {
  return <SwissSection title="范围 3 分类覆盖">
    <p className="dash-card__note">依据快照中已标注的分类汇总。空缺待核对适用性及收集活动数据。</p>
    <table className="dash-mini"><thead><tr><th>价值链分类</th><th>核算结果 kgCO₂e</th><th>覆盖说明</th></tr></thead>
      <tbody>{production.scope3.map((row) => <tr key={row.category ?? 0}>
        <td>{row.category ? `${row.category} · ${scope3Categories[row.category - 1]}` : '未分类记录'}</td>
        <td>{row.has_records ? formatEmission(row.emissions_kgco2e) : '—'}</td>
        <td>{row.assessment?.rationale ?? (row.has_records ? '有核算记录' : '待评估')}</td>
      </tr>)}</tbody>
    </table>
  </SwissSection>
}
