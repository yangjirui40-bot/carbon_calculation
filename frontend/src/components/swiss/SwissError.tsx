import { Link } from 'react-router-dom'
import SwissButton from './SwissButton'
import './SwissError.css'

export type SwissErrorProps = {
  /** 后端返回的 detail 原文，原样展示 */
  message: string
  onRetry?: () => void
  backTo?: { to: string; label: string }
}

/** 错误状态：原因 + 重试 + 返回安全页 */
export default function SwissError({ message, onRetry, backTo }: SwissErrorProps) {
  return (
    <div className="swiss-error" role="alert">
      <div className="swiss-error__kicker">Error</div>
      <p className="swiss-error__message">{message}</p>
      {onRetry || backTo ? (
        <div className="swiss-error__actions">
          {onRetry ? (
            <SwissButton variant="primary" onClick={onRetry}>
              重试
            </SwissButton>
          ) : null}
          {backTo ? (
            <Link className="swiss-error__back" to={backTo.to}>
              {backTo.label} →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
