import { useState } from 'react'
import type { HeatmapNode, RiskLevel } from '../../api/types'
import { formatNumber } from '../../utils/format'
import { RISK_LABELS, tierLabel, INTENSITY_UNIT } from './constants'
import './RiskMatrix.css'

const risks: RiskLevel[] = ['red','yellow','green','unknown']
export default function RiskMatrix({nodes,selectedId,onSelect}:{
  nodes:HeatmapNode[];selectedId:string|null;onSelect:(id:string|null)=>void
}) {
  const [cell,setCell]=useState<{tier:number;risk:RiskLevel}|null>(null)
  const tiers=[...new Set(nodes.map(n=>n.tier))].sort((a,b)=>a-b)
  const ordered=nodes.filter(n=>!cell || (n.tier===cell.tier && n.risk_level===cell.risk))
    .sort((a,b)=>risks.indexOf(a.risk_level)-risks.indexOf(b.risk_level)||(b.propagated_intensity??-1)-(a.propagated_intensity??-1)||a.name.localeCompare(b.name,'zh-CN'))
  return <div className="risk-explorer">
    <div><h3>风险分布 <small>供应商家数</small></h3>
      <table className="risk-matrix"><thead><tr><th>供应层级</th>{risks.map(r=><th key={r} scope="col">{RISK_LABELS[r]}</th>)}</tr></thead><tbody>{tiers.map(t=><tr key={t}><th scope="row">{tierLabel(t)}</th>
        {risks.map(r=>{const count=nodes.filter(n=>n.tier===t && n.risk_level===r).length
          const active=cell?.tier===t && cell.risk===r
          return <td key={r}><button type="button" data-risk={r} disabled={!count} aria-pressed={active} aria-label={`${tierLabel(t)}，${RISK_LABELS[r]}，${count} 家`}
            onClick={()=>{setCell(active?null:{tier:t,risk:r});onSelect(null)}}>{count}</button></td>})}</tr>)}</tbody></table>
      <p>点选格子查看该层级的供应商。缺数据单独统计。</p>
    </div>
    <div><h3>{cell?`${tierLabel(cell.tier)} · ${RISK_LABELS[cell.risk]}`:'供应商核查清单'} <small>{ordered.length} 家</small>{cell&&<button type="button" onClick={()=>{setCell(null);onSelect(null)}}>清除选择</button>}</h3>
      <div className="risk-key"><span>供应商 / 强度来源</span><span>{INTENSITY_UNIT}</span></div>
      <div className="risk-list" aria-label="供应商核查清单">{ordered.map(n=><button type="button" key={n.id} data-risk={n.risk_level} aria-pressed={selectedId===n.id}
        onClick={()=>onSelect(selectedId===n.id?null:n.id)}><i/><span><b>{n.name.replace(/（模拟）$/,'')}</b><small>{RISK_LABELS[n.risk_level]} · {n.propagated_intensity==null?'缺数据':n.estimated?'邻接估算':'填报强度'}</small></span><strong>{n.propagated_intensity==null?'待补':formatNumber(n.propagated_intensity,3)}</strong><em>›</em></button>)}</div>
    </div></div>
}
