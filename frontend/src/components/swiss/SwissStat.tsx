import type { ReactNode } from 'react'
import './SwissStat.css'

export type SwissStatProps = {
  label: string
  value: ReactNode
  unit?: string
  hint?: ReactNode
  tone?: 'default' | 'accent' | 'warn' | 'fail'
}

/** 指标块：小号大写标签 + 等宽大号数字，tone 只改文字颜色 */
export default function SwissStat({
  label,
  value,
  unit,
  hint,
  tone = 'default',
}: SwissStatProps) {
  return (
    <div className={`swiss-stat swiss-stat--${tone}`}>
      <div className="swiss-stat__label">{label}</div>
      <div className="swiss-stat__value">
        <span className="swiss-stat__number">{value}</span>
        {unit ? <span className="swiss-stat__unit">{unit}</span> : null}
      </div>
      {hint ? <div className="swiss-stat__hint">{hint}</div> : null}
    </div>
  )
}
