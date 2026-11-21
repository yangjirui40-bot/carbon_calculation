import { useEffect, useMemo, useState } from 'react'
import { http } from '../../../api/client'
import type { SourceDocument } from '../../../api/types'
import { fieldLabel } from '../../documents/meta'
import './ReviewSourcePanel.css'

type Word = { text: string; box: number[]; confidence?: number }
type Props = { document: SourceDocument; activeField: string | null; value: string }
export default function ReviewSourcePanel({ document, activeField, value }: Props) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [zoom, setZoom] = useState(1)
  const [size, setSize] = useState({ width: 1, height: 1 })
  useEffect(() => {
    const controller = new AbortController()
    let objectUrl = ''
    http.get<Blob>(`/api/v1/documents/${document.id}/preview`, { responseType: 'blob', signal: controller.signal })
      .then(({ data }) => { objectUrl = URL.createObjectURL(data); setUrl(objectUrl) })
      .catch(() => { if (!controller.signal.aborted) setError('原图暂时无法读取，请刷新重试') })
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [document.id])
  const words = useMemo(() => {
    const raw = document.extracted_fields
    if (!raw || typeof raw !== 'object' || !('words' in raw) || !Array.isArray(raw.words)) return []
    return raw.words.filter((x): x is Word => Boolean(x && typeof x === 'object' && 'text' in x && typeof x.text === 'string' && 'box' in x && Array.isArray(x.box) && x.box.length === 4))
  }, [document.extracted_fields])
  const normalize = (text: string) => text.replace(/[\s,，￥¥元]/g, '').toLowerCase()
  const highlights = words.filter((word) => {
    if (!activeField) return false
    const text = normalize(word.text), target = normalize(value)
    return text.includes(fieldLabel(activeField)) || (target.length >= 2 && (text === target || text.endsWith(target)))
  })
  return <section className="review-source">
    <header><h2>原始单据</h2><div className="review-source__controls"><button type="button" aria-label="缩小原图" disabled={zoom <= 1} onClick={() => setZoom(Math.max(1, zoom - 0.5))}>−</button><span>{zoom * 100}%</span><button type="button" aria-label="放大原图" disabled={zoom >= 3} onClick={() => setZoom(Math.min(3, zoom + 0.5))}>＋</button></div></header>
    <p>{activeField ? `正在核对：${fieldLabel(activeField)} · 原图定位提示需人工确认` : '点击右侧识别字段，在原图中核对对应文字与金额。'}</p>
    {error ? <p role="alert">{error}</p> : !url ? <p role="status">正在读取原始单据…</p> : <div className="review-source__scroll"><div className="review-source__canvas" style={{ width: `${zoom * 100}%` }}><img src={url} alt={`${document.file_name} 原始单据`} onLoad={(e) => setSize({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })} /><svg viewBox={`0 0 ${size.width} ${size.height}`} aria-hidden="true">{highlights.map((w, i) => <rect key={i} x={w.box[0]} y={w.box[1]} width={w.box[2] - w.box[0]} height={w.box[3] - w.box[1]} />)}</svg></div></div>}
    <footer>原文件与识别结果均按企业权限读取；修订字段不会修改原始单据。</footer>
  </section>
}
