import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import './SwissMasthead.css'

export type SwissMastheadProps = {
  kicker?: string
  title: string
  description?: ReactNode
  actions?: ReactNode
  backTo?: { to: string; label: string }
}

/** 页面眉标：Kicker + 大标题 + 说明 + 右侧操作，可选返回链接 */
export default function SwissMasthead({
  kicker,
  title,
  description,
  actions,
  backTo,
}: SwissMastheadProps) {
  return (
    <header className="swiss-page-masthead">
      {backTo ? (
        <Link className="swiss-page-masthead__back" to={backTo.to}>
          ← {backTo.label}
        </Link>
      ) : null}
      <div className="swiss-page-masthead__main">
        <div className="swiss-page-masthead__text">
          {kicker ? <div className="swiss-page-masthead__kicker">{kicker}</div> : null}
          <h1 className="swiss-page-masthead__title">{title}</h1>
          {description ? <div className="swiss-page-masthead__desc">{description}</div> : null}
        </div>
        {actions ? <div className="swiss-page-masthead__actions">{actions}</div> : null}
      </div>
    </header>
  )
}
