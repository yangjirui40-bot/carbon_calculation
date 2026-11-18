import type { ParseStatus } from '../../api/types'
import './StatusTag.css'

type StatusTone = 'pending' | 'info' | 'failed'

// 王惠宇 2026-11-04《数据字段表》4.2：单据只有 pending / parsed / failed
const STATUS_META: Record<ParseStatus, { label: string; tone: StatusTone }> = {
  pending: { label: '待解析', tone: 'pending' },
  parsed: { label: '已解析', tone: 'info' },
  failed: { label: '解析失败', tone: 'failed' },
}

type StatusTagProps = {
  status: ParseStatus
}

/** 单据解析状态：颜色 + 文字，不只靠颜色 */
export default function StatusTag({ status }: StatusTagProps) {
  const meta = STATUS_META[status]
  return (
    <span className={`status-tag status-tag--${meta.tone}`}>
      <span className="status-tag__dot" aria-hidden="true" />
      {meta.label}
    </span>
  )
}
