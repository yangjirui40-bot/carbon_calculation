import { CONFIDENCE_THRESHOLD } from '../../config/business'
import './ConfidenceTag.css'

type ConfidenceTagProps = {
  /** 0—1；缺失时显示“无置信度” */
  value?: number
  threshold?: number
}

/**
 * 置信度标签：图标 + 数值 + 文字（01 §0 通用规则）。
 * 不只靠颜色区分。
 */
export default function ConfidenceTag({
  value,
  threshold = CONFIDENCE_THRESHOLD,
}: ConfidenceTagProps) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return (
      <span className="confidence-tag confidence-tag--unknown">— 无置信度</span>
    )
  }

  const passed = value >= threshold
  return (
    <span
      className={`confidence-tag ${passed ? 'confidence-tag--passed' : 'confidence-tag--review'}`}
      aria-label={passed ? `置信度 ${value.toFixed(2)}，已通过` : `置信度 ${value.toFixed(2)}，需核对`}
    >
      {passed ? '✓' : '⚠'} {value.toFixed(2)} {passed ? '已通过' : '需核对'}
    </span>
  )
}
