import { formatNumber } from '../../../utils/format'
import './WorkspaceMetrics.css'

type WorkspaceMetricsProps = {
  documentCount: number
  reviewCount: number
  runCount: number
}

export default function WorkspaceMetrics({
  documentCount,
  reviewCount,
  runCount,
}: WorkspaceMetricsProps) {
  const items = [
    { value: documentCount, label: '单据 / Documents' },
    { value: reviewCount, label: '待核对 / To review' },
    { value: runCount, label: '核算次数 / Runs' },
  ]

  return (
    <section className="ws-metrics" aria-label="本期概况">
      {items.map((item) => (
        <div className="ws-metric" key={item.label}>
          <strong>{formatNumber(item.value, 0)}</strong>
          <span>{item.label}</span>
        </div>
      ))}
    </section>
  )
}
