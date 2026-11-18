import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { ReviewQueueItem, SourceDocument } from '../../../api/types'
import LineIcon from '../../../components/common/LineIcon'
import { CONFIDENCE_THRESHOLD } from '../../../config/business'
import { formatDateTime } from '../../../utils/format'
import { docStatus, docTypeLabel, type DocStatusTone } from '../meta'
import './DocumentsList.css'

type Filter = 'all' | 'todo' | 'review' | 'confirmed' | 'failed'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'todo', label: '待解析' },
  { key: 'review', label: '待复核' },
  { key: 'confirmed', label: '已入库' },
  { key: 'failed', label: '异常' },
]

const TONE_CLASS: Record<DocStatusTone, string> = {
  ok: 'is-ok',
  pending: 'is-pending',
  review: 'is-review',
  fail: 'is-fail',
}

function matchesFilter(doc: SourceDocument, filter: Filter): boolean {
  switch (filter) {
    case 'todo':
      return doc.parse_status === 'uploaded' || doc.parse_status === 'parsing'
    case 'review':
      return doc.parse_status === 'parsed' && doc.review_status === 'pending'
    case 'confirmed':
      return doc.parse_status === 'parsed' && doc.review_status === 'confirmed'
    case 'failed':
      return doc.parse_status === 'failed' || doc.review_status === 'rejected'
    default:
      return true
  }
}

type DocumentsListProps = {
  documents: SourceDocument[]
  queue: ReviewQueueItem[]
  loading: boolean
  error: string | null
  parsingId: number | null
  onRetry: () => void
  onParse: (doc: SourceDocument) => void
  onManual: () => void
}

export default function DocumentsList({
  documents,
  queue,
  loading,
  error,
  parsingId,
  onRetry,
  onParse,
  onManual,
}: DocumentsListProps) {
  const [filter, setFilter] = useState<Filter>('all')

  const queueReasons = new Map(queue.map((item) => [item.id, item.reasons]))
  const rows = documents.filter((doc) => matchesFilter(doc, filter))

  return (
    <section className="doc-list-panel">
      <div className="doc-list-head">
        <h2>单据列表</h2>
        <span>
          按上传时间倒序
          {queue.length > 0 ? ` · 复核队列 ${queue.length} 张` : ''}
        </span>
      </div>

      <div className="doc-tabs" role="tablist" aria-label="单据状态筛选">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={filter === item.key}
            className={filter === item.key ? 'doc-tab is-active' : 'doc-tab'}
            onClick={() => setFilter(item.key)}
          >
            {item.label}{' '}
            <em>{documents.filter((doc) => matchesFilter(doc, item.key)).length}</em>
          </button>
        ))}
      </div>

      {error ? (
        <div className="doc-list-error" role="alert">
          <span>{error}</span>
          <button type="button" className="doc-action-link" onClick={onRetry}>
            重试
          </button>
        </div>
      ) : null}

      <div className="doc-rows">
        {loading ? (
          <div className="doc-empty">正在加载单据…</div>
        ) : (
          rows.map((doc, index) => {
            const status = docStatus(doc)
            const reasons = queueReasons.get(doc.id) ?? []
            const confidence = doc.overall_confidence
            const lowConfidence =
              confidence !== null && confidence < CONFIDENCE_THRESHOLD
            const correcting = parsingId === doc.id || doc.parse_status === 'parsing'

            return (
              <div className="doc-row" key={doc.id}>
                <span className="doc-no">{String(index + 1).padStart(2, '0')}</span>

                <div className="doc-file">
                  <LineIcon name="file-text" size={15} />
                  <div className="doc-file-text">
                    <b>{doc.file_name}</b>
                    <span>
                      {docTypeLabel(doc.doc_type)} · {doc.file_ext.toUpperCase()}
                      {confidence !== null
                        ? ` · 置信度 ${lowConfidence ? '⚠' : '✓'} ${confidence.toFixed(2)}`
                        : ''}
                      {doc.correction_log && doc.correction_log.length > 0
                        ? ` · 纠偏 ${doc.correction_log.length} 处`
                        : ''}
                    </span>
                    {reasons.length > 0 ? (
                      <span className="doc-reasons">{reasons.join('；')}</span>
                    ) : null}
                  </div>
                </div>

                <span className="doc-time">
                  {doc.created_at ? formatDateTime(doc.created_at).slice(5) : '—'}
                </span>

                <span className={`doc-status ${TONE_CLASS[status.tone]}`}>
                  {status.label}
                </span>

                <span className="doc-action">
                  {correcting ? (
                    <span className="doc-action-muted">识别中…</span>
                  ) : doc.parse_status === 'uploaded' ? (
                    <button
                      type="button"
                      className="doc-action-link"
                      onClick={() => onParse(doc)}
                    >
                      解析
                    </button>
                  ) : doc.parse_status === 'failed' ? (
                    <span className="doc-action-pair">
                      <button
                        type="button"
                        className="doc-action-link"
                        onClick={() => onParse(doc)}
                      >
                        重试
                      </button>
                      <button type="button" className="doc-action-link" onClick={onManual}>
                        转人工
                      </button>
                    </span>
                  ) : doc.review_status === 'confirmed' ? (
                    <span className="doc-action-muted">已入库</span>
                  ) : doc.review_status === 'rejected' ? (
                    <Link className="doc-action-link" to={`/documents/${doc.id}/review`}>
                      重新核对
                    </Link>
                  ) : (
                    <Link className="doc-action-link" to={`/documents/${doc.id}/review`}>
                      核对
                    </Link>
                  )}
                </span>
              </div>
            )
          })
        )}

        {!loading && rows.length === 0 && !error ? (
          <div className="doc-empty">
            {documents.length === 0
              ? '还没有单据。上传一张发票或电费单，系统会自动识别。'
              : '没有符合当前筛选条件的单据'}
          </div>
        ) : null}
      </div>
    </section>
  )
}
