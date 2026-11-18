import type { ComponentPropsWithRef } from 'react'
import './SwissTextarea.css'

export type SwissTextareaProps = ComponentPropsWithRef<'textarea'>

/** 下划线多行输入框；错误态由父级 SwissField 控制 */
export default function SwissTextarea({ className, rows = 4, ...rest }: SwissTextareaProps) {
  return (
    <textarea
      rows={rows}
      className={className ? `swiss-textarea ${className}` : 'swiss-textarea'}
      {...rest}
    />
  )
}
