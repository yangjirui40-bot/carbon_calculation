import type { BusinessRecord, Scope } from '../../api/types'
import { CATEGORY_LABELS } from '../../config/business'
import { formatAmount, formatNumber, formatScope } from '../../utils/format'
import './LocalRecords.css'

type LocalRecordsProps = {
  records: BusinessRecord[]
}

export default function LocalRecords({ records }: LocalRecordsProps) {
  if (records.length === 0) return null

  return (
    <section className="local-records">
      <div className="local-records-head">
        <h2>本次新增</h2>
        <span>已写入业务记录 · 参与后续核算</span>
      </div>

      <div className="local-records-list">
        {records.map((record) => (
          <div className="local-record-row" key={record.id}>
            <b>{record.remark || record.record_no}</b>
            <span>
              {CATEGORY_LABELS[record.category as keyof typeof CATEGORY_LABELS] ??
                record.category}
            </span>
            <span>{formatScope(record.scope as Scope)}</span>
            <span className="num">
              {record.quantity !== null
                ? `${formatNumber(record.quantity, 2)} ${record.unit ?? ''}`
                : formatAmount(record.amount)}
            </span>
            <span className="num">{record.period}</span>
            <span className="local-record-status is-ok">已入库</span>
          </div>
        ))}
      </div>
    </section>
  )
}
