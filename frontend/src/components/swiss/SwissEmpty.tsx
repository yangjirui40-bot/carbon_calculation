import type { ReactNode } from 'react'
import './SwissEmpty.css'

export type SwissEmptyProps = {
  title: string
  description?: string
  action?: ReactNode
}

/** 空状态：一句话 + 可选说明 + 一个下一步操作 */
export default function SwissEmpty({ title, description, action }: SwissEmptyProps) {
  return (
    <div className="swiss-empty">
      <p className="swiss-empty__title">{title}</p>
      {description ? <p className="swiss-empty__desc">{description}</p> : null}
      {action ? <div className="swiss-empty__action">{action}</div> : null}
    </div>
  )
}
