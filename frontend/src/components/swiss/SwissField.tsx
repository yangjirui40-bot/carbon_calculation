import type { ReactNode } from 'react'
import './SwissField.css'

export type SwissFieldProps = {
  label: string
  htmlFor?: string
  required?: boolean
  error?: string
  hint?: string
  children: ReactNode
}

/**
 * 表单字段：标签在上、小号大写；error 用 fail 色，hint 用 muted。
 * 错误态由本组件通过 swiss-field--error 下发，子输入框只负责基础下划线样式。
 */
export default function SwissField({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
}: SwissFieldProps) {
  const fieldClass = error ? 'swiss-field swiss-field--error' : 'swiss-field'

  return (
    <div className={fieldClass}>
      <label className="swiss-field__label" htmlFor={htmlFor}>
        {label}
        {required ? (
          <span className="swiss-field__required" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      <div className="swiss-field__control">{children}</div>
      {error ? (
        <div className="swiss-field__error" role="alert">
          {error}
        </div>
      ) : hint ? (
        <div className="swiss-field__hint">{hint}</div>
      ) : null}
    </div>
  )
}
