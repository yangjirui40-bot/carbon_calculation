import type { ReactNode } from 'react'
import './StatCard.css'

type StatCardProps = {
  label: string
  /** 已格式化的数值，例如 4,514.40 */
  value: string
  unit?: string
  hint?: ReactNode
}

/** 指标卡：数字等宽、单位独立（02 §4） */
export default function StatCard({ label, value, unit, hint }: StatCardProps) {
  return (
    <section className="stat-card">
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value">
        <span className="stat-card__number num">{value}</span>
        {unit ? <span className="stat-card__unit">{unit}</span> : null}
      </div>
      {hint ? <div className="stat-card__hint">{hint}</div> : null}
    </section>
  )
}
