import type { ButtonHTMLAttributes } from 'react'
import './SwissButton.css'

export type SwissButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger'
  loading?: boolean
}

/**
 * 瑞士风格按钮：0 圆角、40px 高、12px 700。
 * primary 深绿底浅绿字；ghost 透明底细线；danger 透明底 fail 边框。
 */
export default function SwissButton({
  variant = 'primary',
  loading = false,
  disabled,
  className,
  type = 'button',
  children,
  ...rest
}: SwissButtonProps) {
  const classes = ['swiss-button', `swiss-button--${variant}`]
  if (loading) classes.push('is-loading')
  if (className) classes.push(className)

  return (
    <button
      {...rest}
      type={type}
      className={classes.join(' ')}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <span className="swiss-button__spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  )
}
