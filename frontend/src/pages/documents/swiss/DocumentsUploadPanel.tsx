import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import { CameraOutlined, InboxOutlined, TableOutlined } from '@ant-design/icons'
import { documentsApi } from '../../../api'
import { ApiRequestError } from '../../../api/client'
import { DOC_TYPE_OPTIONS, type DocTypeOption } from '../meta'
import './DocumentsUploadPanel.css'

const MAX_SIZE = 20 * 1024 * 1024
const MAX_FILES = 50
const ACCEPT = '.jpg,.jpeg,.png,.pdf'

type Item = {
  name: string
  state: '待上传' | '上传中' | '识别中' | '待复核' | '已上传' | '异常' | '疑似重复'
  id?: number
  note?: string
}

export default function DocumentsUploadPanel({ companyId, onManual, onCompleted }: {
  companyId: number | null
  onManual: () => void
  onCompleted: () => void
}) {
  const picker = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)
  const pending = useRef(false)
  const [docType, setType] = useState<DocTypeOption>('invoice')
  const [items, setItems] = useState<Item[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const disabled = companyId === null || busy

  async function process(files: File[]) {
    if (companyId === null || pending.current || files.length === 0) return
    setError('')
    if (files.length > MAX_FILES) {
      setError(`每批最多 ${MAX_FILES} 份，请分批选择。`)
      return
    }
    pending.current = true
    setBusy(true)
    setItems(files.map((file) => ({ name: file.name, state: '待上传' })))

    function update(index: number, patch: Partial<Item>) {
      setItems((previous) => previous.map((item, i) => i === index ? { ...item, ...patch } : item))
    }

    try {
      for (const [index, file] of files.entries()) {
        if (file.size === 0 || file.size > MAX_SIZE || !/\.(jpe?g|png|pdf)$/i.test(file.name)) {
          update(index, { state: '异常', note: ' 请选择不超过 20 MB 的非空 JPG、PNG 或 PDF。' })
          continue
        }
        let id: number | undefined
        try {
          update(index, { state: '上传中' })
          const uploaded = await documentsApi.uploadDocument(file, companyId, docType)
          id = uploaded.id
          if (uploaded.duplicate_hint) {
            update(index, { id, state: '疑似重复', note: uploaded.duplicate_hint + '，当前单据保留在待解析列表。' })
            continue
          }
          update(index, { id, state: '识别中' })
          await documentsApi.parseDocument(id)
          update(index, { state: '已上传', note: '已进入识别队列，可在单据列表查看进度。' })
        } catch (err) {
          const message = err instanceof ApiRequestError ? err.message : '传输中断，请查看单据状态。'
          update(index, { id, state: '异常', note: id ? `已保存原件。 ${message}` : message })
        }
      }
    } finally {
      pending.current = false
      setBusy(false)
      onCompleted()
    }
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    void process(files)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    if (!disabled) void process(Array.from(event.dataTransfer.files))
  }

  return (
    <section className="doc-upload-panel">
      <div className={dragging ? 'doc-upload-box is-dragging' : 'doc-upload-box'}
        onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragging(true) }}
        onDragLeave={() => setDragging(false)} onDrop={handleDrop}>
        <div className="doc-upload-icon"><InboxOutlined /></div>
        <h2>上传原始凭证</h2>
        <p>拖入票据，或一次选择多份同类型文件。识别后的字段进入复核队列。</p>
        <div className="doc-type-row" role="group" aria-label="票据类型">
          {DOC_TYPE_OPTIONS.map((option) => (
            <button key={option.value} type="button" className={option.value === docType ? 'doc-type-chip is-active' : 'doc-type-chip'}
              aria-pressed={option.value === docType} disabled={busy} onClick={() => setType(option.value)}>
              {option.label}
            </button>
          ))}
        </div>
        <input ref={picker} type="file" multiple accept={ACCEPT} className="doc-file-input" onChange={handleInput} />
        <input ref={camera} type="file" accept="image/jpeg,image/png" capture="environment" className="doc-file-input" onChange={handleInput} />
        <div className="doc-upload-actions">
          <button type="button" className="doc-btn-primary" disabled={disabled} onClick={() => picker.current?.click()}>
            {busy ? '正在处理批次…' : '选择文件'}
          </button>
          <button type="button" className="doc-camera" disabled={disabled} onClick={() => camera.current?.click()}>
            <CameraOutlined /> 拍摄凭证
          </button>
        </div>
        <div className="doc-upload-note">{companyId === null ? '请先选择企业' : 'JPG、PNG、PDF · 每份 20 MB 以内 · 每批最多 50 份'}</div>
      </div>

      {error && <div className="doc-upload-error" role="alert">{error}</div>}
      {items.length > 0 && <section className="doc-batch" aria-label="本批处理结果" aria-live="polite">
        {items.map((item, index) => (
          <div className="doc-batch__item" key={index}>
            <div><b>{item.name}</b><span>{item.state}</span></div>
            {item.note && <p>{item.note}</p>}
            {item.state === '待复核' && item.id && <Link to={`/documents/${item.id}/review`}>查看原件并复核 →</Link>}
          </div>
        ))}
      </section>}
      <Link to="/records" className="doc-manual"><span><TableOutlined /> 导入 Excel / CSV 台账</span><span aria-hidden="true">›</span></Link>
      <button type="button" className="doc-manual" onClick={onManual} disabled={companyId === null}>手工录入业务记录 <span aria-hidden="true">＋</span></button>
    </section>
  )
}
