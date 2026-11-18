import type { ComponentPropsWithRef } from 'react'
import './SwissInput.css'

export type SwissInputProps = ComponentPropsWithRef<'input'>

/** 下划线输入框：透明底、底部 1px rule、聚焦变 accent；错误态由父级 SwissField 控制 */
export default function SwissInput({ className, ...rest }: SwissInputProps) {
  return <input className={className ? `swiss-input ${className}` : 'swiss-input'} {...rest} />
}
