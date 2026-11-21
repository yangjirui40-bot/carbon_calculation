import { useEffect, useState } from 'react'
import { supplyChainApi } from '../../api'
import type { HeatmapNode, SupplierEvidence } from '../../api/types'
import { SwissEmpty, SwissSection } from '../../components/swiss'
import { formatDateTime, formatEmission, formatNumber } from '../../utils/format'
import RiskMatrix from './RiskMatrix'
import { INTENSITY_UNIT } from './constants'

function source(node: HeatmapNode) {
  if (node.propagated_intensity == null) return '缺数据'
  return node.estimated ? '邻接估算' : '填报强度'
}

export default function SupplyHeatmap({ companyId, nodes, selectedId, onSelect, thresholds }: {
  companyId:number
  nodes:HeatmapNode[]
  selectedId:string|null
  onSelect:(id:string|null)=>void
  thresholds?: {low:number; high:number}
}) {
  const selected = nodes.find((node) => node.id===selectedId)
  const [evidence,setEvidence] = useState<SupplierEvidence|null>(null)
  const [error,setError] = useState('')
  const [loading,setLoading] = useState(false)
  const key = selected?.id
  useEffect(() => {
    if (!key) return
    const controller = new AbortController()
    setEvidence(null)
    setError('')
    setLoading(true)
    void supplyChainApi.getSupplierEvidence(companyId,key,controller.signal)
      .then((next) => { if (!controller.signal.aborted) setEvidence(next) })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '供应商详情暂时无法读取')
      }).finally(() => {if (!controller.signal.aborted) setLoading(false)})
    return () => controller.abort()
  }, [companyId,key])

  return (
    <SwissSection title="供应链碳热力图" extra={`当前筛选 · ${INTENSITY_UNIT}`}>
      {nodes.length===0 ? <SwissEmpty title="没有符合条件的供应商" /> : (
        <>
          <div className="heatmap-scale" aria-label="碳风险图例">
            <span data-risk="red">高风险{thresholds ? ` ≥ ${thresholds.high}` : ''}</span>
            <span data-risk="yellow">中风险{thresholds ? ` ${thresholds.low}–${thresholds.high}` : ''}</span>
            <span data-risk="green">低风险{thresholds ? ` ＜ ${thresholds.low}` : ''}</span>
            <span data-risk="unknown">缺数据</span>
          </div>
          <RiskMatrix nodes={nodes} selectedId={selectedId} onSelect={onSelect}/>
          {selected && <div className="heatmap-evidence" role="region" aria-label="供应商碳数据">
            <div className="heatmap-evidence__head">
              <h3>{selected.name} · 碳数据</h3>
              <button type="button" className="sc-export-button" onClick={() => onSelect(null)}>关闭详情</button>
            </div>
            <dl>
              <div><dt>数据来源</dt><dd>{source(selected)}</dd></div>
              <div><dt>碳强度</dt><dd>{selected.propagated_intensity == null ? '—' : `${formatNumber(selected.propagated_intensity,3)} ${INTENSITY_UNIT}`}</dd></div>
              <div><dt>行业与地区</dt><dd>{[selected.industry,selected.region].filter(Boolean).join(' · ') || '—'}</dd></div>
              <div><dt>档案更新时间</dt><dd>{formatDateTime(selected.updated_at)}</dd></div>
            </dl>
            {loading && <p role="status">正在读取填报与上下游关系…</p>}
            {error && <p role="alert">{error}</p>}
            {evidence?.node.id===selected.id && <>
              <p><b>关联节点</b> {evidence.relationships.map((record) => record.name).join('、') || '无直接关联节点'}</p>
              {evidence.submissions.length ? <ul aria-label="最近供应商填报">{evidence.submissions.map((entry) =>
                <li key={entry.period}>{entry.period} · {formatEmission(entry.emissions_kgco2e)} kgCO₂e
                  {entry.intensity != null && ` · ${formatNumber(entry.intensity,3)} ${INTENSITY_UNIT}`}</li>
              )}</ul> : <p>当前供应商没有门户填报记录。详情所示的填报强度可来自企业登记的档案。</p>}
            </>}
          </div>}
          <p className="heatmap-note">风险按碳强度阈值划分。邻接估算用于筛查，缺数据保持未知。</p>
        </>
      )}
    </SwissSection>
  )
}
