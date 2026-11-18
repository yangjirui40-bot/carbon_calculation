import { Button } from 'antd'
import type { ReactNode } from 'react'
import './ErrorState.css'

type ErrorStateProps = {
  title?: string
  description: string
  onRetry?: () => void
  retryText?: string
  /** 替代路径，例如“转人工录入” */
  extra?: ReactNode
}

export default function ErrorState({
  title = '加载失败',
  description,
  onRetry,
  retryText = '重试',
  extra,
}: ErrorStateProps) {
  return (
    <section className="error-state" role="alert">
      <h2 className="error-state__title">{title}</h2>
      <p className="error-state__desc">{description}</p>
      {onRetry || extra ? (
        <div className="error-state__actions">
          {onRetry ? (
            <Button onClick={onRetry}>{retryText}</Button>
          ) : null}
          {extra}
        </div>
      ) : null}
    </section>
  )
}
