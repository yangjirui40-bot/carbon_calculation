import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { documentsApi } from '../../../api'
import { ApiRequestError } from '../../../api/client'
import type { BackendParseStatus, SourceDocument } from '../../../api/types'
import LineIcon from '../../../components/common/LineIcon'
import { DOC_TYPE_OPTIONS, type DocTypeOption } from '../meta'
import './DocumentsUploadPanel.css'

const MAX_SIZE = 20 * 1024 * 1024
const ACCEPT = '.jpg,.jpeg,.png,.pdf'
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf']

type Phase = 'idle' | 'uploading' | 'parsing'

type UploadResult = {
  fileName: string
  status: BackendParseStatus
  confidence: number | null
  duplicateHint: string | null
}

type DocumentsUploadPanelProps = {
  companyId: number | null
  onManual: () => void
  onUploaded: (doc: SourceDocument) => void
}

/** 上传 → 同步解析（wait=true）→ 刷新列表；解析失败可重试或转人工 */
export default function DocumentsUploadPanel({
  companyId,
  onManual,
  onUploaded,
}: DocumentsUploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [docType, setDocType] = useState<DocTypeOption>('invoice')
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [dragging, setDragging] = useState(false)

  const busy = phase !== 'idle'
  const disabled = companyId === null || busy

  async function handleFile(file: File) {
    if (companyId === null) {
      setError('请先选择企业')
      return
    }
    if (file.size > MAX_SIZE) {
      setError('文件超过 20 MB，请压缩后重试')
      return
    }
    const extOk = /\.(jpe?g|png|pdf)$/i.test(file.name)
    if (!ALLOWED_TYPES.includes(file.type) && !extOk) {
      setError('仅支持 jpg / png / pdf')
      return
    }

    setError(null)
    setResult(null)
    setPhase('uploading')
    try {
      const uploaded = await documentsApi.uploadDocument(file, companyId, docType)
      setPhase('parsing')
      const parsed = await documentsApi.parseDocument(uploaded.id, true)
      const doc: SourceDocument =
        'parse_status' in parsed ? (parsed as SourceDocument) : uploaded
      setResult({
        fileName: uploaded.file_name,
        status: doc.parse_status,
        confidence: doc.overall_confidence,
        duplicateHint: uploaded.duplicate_hint,
      })
      onUploaded(doc)
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : '上传或解析失败，请稍后重试',
      )
    } finally {
      setPhase('idle')
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) void handleFile(file)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    if (disabled) return
    const file = event.dataTransfer.files?.[0]
    if (file) void handleFile(file)
  }

  const buttonText =
    phase === 'uploading' ? '上传中…' : phase === 'parsing' ? '识别中…' : '选择文件'

  return (
    <section className="doc-upload-panel">
      <div
        className={dragging ? 'doc-upload-box is-dragging' : 'doc-upload-box'}
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <div>
          <div className="doc-upload-icon">
            <LineIcon name="upload" size={22} />
          </div>
          <h2>把票据放进来</h2>
          <p>
            拖拽图片或 PDF 到这里，系统会识别票面字段并做勾稽纠偏；识别失败时可以转人工录入。
          </p>
        </div>

        <div>
          <div className="doc-type-row" role="group" aria-label="票据类型">
            {DOC_TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={
                  option.value === docType ? 'doc-type-chip is-active' : 'doc-type-chip'
                }
                aria-pressed={option.value === docType}
                disabled={busy}
                onClick={() => setDocType(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="doc-file-input"
            onChange={handleInputChange}
          />
          <button
            type="button"
            className="doc-btn-primary"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            {buttonText}
            <LineIcon name="arrow-up-right" size={15} />
          </button>
          <div className="doc-upload-note">
            {companyId === null
              ? '请先选择企业'
              : 'jpg / png / pdf · ≤ 20 MB · 上传后立即解析'}
          </div>
        </div>
      </div>

      {result ? (
        <div className="doc-upload-result">
          <b>{result.fileName}</b>
          <span>
            {result.status === 'parsed' ? '识别完成' : '已上传，待解析'}
            {result.confidence !== null
              ? ` · 综合置信度 ${result.confidence.toFixed(2)}`
              : ''}
          </span>
          {result.status === 'parsed' ? (
            <span className="doc-upload-result-hint">请到右侧列表进入核对</span>
          ) : null}
          {result.duplicateHint ? (
            <span className="doc-upload-result-warn">{result.duplicateHint}</span>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="doc-upload-error" role="alert">
          {error}
        </div>
      ) : null}

      <button type="button" className="doc-manual" onClick={onManual}>
        <span>手工录入业务记录</span>
        <span className="doc-manual-side">
          <small>不经过 OCR</small>
          <LineIcon name="plus" size={14} />
        </span>
      </button>
    </section>
  )
}
