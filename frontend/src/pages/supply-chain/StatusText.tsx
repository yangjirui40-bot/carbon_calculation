import type { ReactNode } from 'react'
import type { StatusTone } from './constants'
import './shared.css'

/** 计划/交易状态文字：文案本身已表达含义，颜色只做辅助 */
export default function StatusText({
  tone,
  children,
}: {
  tone: StatusTone
  children: ReactNode
}) {
  return <span className={`sc-status sc-status--${tone}`}>{children}</span>
}
