import type { ComponentPropsWithRef } from 'react'
import './SwissSelect.css'

export type SwissSelectProps = ComponentPropsWithRef<'select'>

/**
 * 下划线选择框：外观与 SwissInput 一致，隐藏原生箭头，用 CSS 三角补一个指示符。
 * 错误态由父级 SwissField 控制。
 */
export default function SwissSelect({ className, ...rest }: SwissSelectProps) {
  return (
    <span className="swiss-select-wrap">
      <select className={className ? `swiss-select ${className}` : 'swiss-select'} {...rest} />
      <span className="swiss-select__caret" aria-hidden="true" />
    </span>
  )
}
