import type { RiskLevel } from '../../api/types'
import { RISK_LABELS } from './constants'
import './shared.css'

/** 风险等级：色块 + 文字，不只依赖颜色传达 */
export default function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <span className={`sc-risk sc-risk--${level}`}>
      <span className="sc-risk__dot" aria-hidden="true" />
      {RISK_LABELS[level]}
    </span>
  )
}
