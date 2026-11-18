import type { SourceDocument } from '../../../api/types'
import LineIcon from '../../../components/common/LineIcon'
import { formatDateTime } from '../../../utils/format'
import {
  docTypeLabel,
  REVIEW_STATUS_LABELS,
  VERIFY_STATUS_LABELS,
} from '../../documents/meta'
import './ReviewPreviewPanel.css'

type ReviewPreviewPanelProps = {
  document: SourceDocument
  correctionCount: number
  verifyDetail: string | null
}

/** 原始文件由服务端存储，这里展示已核实的单据元信息 */
export default function ReviewPreviewPanel({
  document,
  correctionCount,
  verifyDetail,
}: ReviewPreviewPanelProps) {
  return (
    <section className="review-preview-panel">
      <div className="review-preview-head">
        <span>单据信息</span>
        <span>{formatDateTime(document.created_at).slice(0, 10)}</span>
      </div>

      <div className="review-preview-body">
        <div className="review-preview-icon">
          <LineIcon name="file-text" size={22} />
        </div>
        <b>{document.file_name}</b>
        <span>{docTypeLabel(document.doc_type)}</span>

        <dl className="review-preview-meta">
          <div>
            <dt>文件类型</dt>
            <dd>{document.file_ext.toUpperCase()}</dd>
          </div>
          <div>
            <dt>上传时间</dt>
            <dd>{formatDateTime(document.created_at)}</dd>
          </div>
          <div>
            <dt>识别引擎</dt>
            <dd>{document.ocr_engine ?? '—'}</dd>
          </div>
          <div>
            <dt>复核状态</dt>
            <dd>{REVIEW_STATUS_LABELS[document.review_status]}</dd>
          </div>
          <div>
            <dt>验真状态</dt>
            <dd className={document.verified_status === 'failed' ? 'is-fail' : undefined}>
              {VERIFY_STATUS_LABELS[document.verified_status]}
            </dd>
          </div>
          <div>
            <dt>勾稽纠偏</dt>
            <dd>{correctionCount} 处</dd>
          </div>
        </dl>

        {verifyDetail ? (
          <p className="review-verify-detail">{verifyDetail}</p>
        ) : null}
      </div>

      <div className="review-preview-foot">原始文件保存在服务端，页面展示识别与复核结果</div>
    </section>
  )
}
