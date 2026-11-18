import { SwissButton } from '../../../components/swiss'
import { CONFIDENCE_THRESHOLD } from '../../../config/business'
import type { VerifyStatus } from '../../../api/types'
import { VERIFY_STATUS_LABELS } from '../../documents/meta'
import './ReviewSidePanel.css'

type Submitting = 'confirm' | 'reject' | 'verify' | null

type ReviewSidePanelProps = {
  confidence: number | null
  correctionCount: number
  fieldCount: number
  verifyStatus: VerifyStatus
  submitting: Submitting
  formError: string | null
  onVerify: () => void
  onConfirm: () => void
  onReject: () => void
}

export default function ReviewSidePanel({
  confidence,
  correctionCount,
  fieldCount,
  verifyStatus,
  submitting,
  formError,
  onVerify,
  onConfirm,
  onReject,
}: ReviewSidePanelProps) {
  const passed = confidence !== null && confidence >= CONFIDENCE_THRESHOLD
  const busy = submitting !== null

  return (
    <aside className="review-side-panel">
      <div className="review-side-title">核对状态</div>

      <div className="review-side-confidence">
        <span className={passed ? 'review-side-value is-ok' : 'review-side-value is-review'}>
          {confidence !== null ? confidence.toFixed(2) : '—'}
        </span>
        <span className="review-side-label">
          综合置信度 · {passed ? '已通过阈值' : '需人工核对'}
        </span>
      </div>

      <dl className="review-side-metrics">
        <div>
          <dt>识别字段</dt>
          <dd>{fieldCount}</dd>
        </div>
        <div>
          <dt>勾稽纠偏</dt>
          <dd>{correctionCount} 处</dd>
        </div>
        <div>
          <dt>发票验真</dt>
          <dd className={verifyStatus === 'failed' ? 'is-fail' : undefined}>
            {VERIFY_STATUS_LABELS[verifyStatus]}
          </dd>
        </div>
      </dl>

      {verifyStatus === 'failed' ? (
        <p className="review-side-blocker">验真未通过，修订字段并重新验真后才能入库。</p>
      ) : null}

      {formError ? (
        <p className="review-side-error" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="review-side-actions">
        <SwissButton
          variant="ghost"
          className="review-side-button"
          loading={submitting === 'verify'}
          disabled={busy}
          onClick={onVerify}
        >
          发票验真
        </SwissButton>
        <SwissButton
          variant="primary"
          className="review-side-button"
          loading={submitting === 'confirm'}
          disabled={busy || verifyStatus === 'failed'}
          onClick={onConfirm}
        >
          确认入库
        </SwissButton>
        <SwissButton
          variant="danger"
          className="review-side-button"
          loading={submitting === 'reject'}
          disabled={busy}
          onClick={onReject}
        >
          驳回单据
        </SwissButton>
      </div>

      <p className="review-side-note">
        字段修订与入账信息随「确认入库」一起提交；驳回不生成业务记录。
      </p>
    </aside>
  )
}
