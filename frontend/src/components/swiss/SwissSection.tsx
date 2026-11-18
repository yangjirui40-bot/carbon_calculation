import type { ReactNode } from 'react'
import './SwissSection.css'

export type SwissSectionProps = {
  kicker?: string
  title?: string
  extra?: ReactNode
  children: ReactNode
}

/** 内容分区：顶部 1px 细线，标题小号大写，extra 右对齐 */
export default function SwissSection({ kicker, title, extra, children }: SwissSectionProps) {
  const hasHead = Boolean(kicker || title || extra)

  return (
    <section className="swiss-section">
      {hasHead ? (
        <header className="swiss-section__head">
          <div className="swiss-section__titles">
            {kicker ? <div className="swiss-section__kicker">{kicker}</div> : null}
            {title ? <h2 className="swiss-section__title">{title}</h2> : null}
          </div>
          {extra ? <div className="swiss-section__extra">{extra}</div> : null}
        </header>
      ) : null}
      <div className="swiss-section__body">{children}</div>
    </section>
  )
}
