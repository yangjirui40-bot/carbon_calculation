import type { ReductionPlanRecord, SupplierRecord } from '../../api/types'
import SwissTable, {
  type SwissTableColumn,
} from '../../components/swiss/SwissTable'
import { formatPercent } from '../../utils/format'
import StatusText from './StatusText'
import { planStatusLabel, planStatusTone } from './constants'
import './shared.css'

const COLUMNS: SwissTableColumn[] = [
  { key: 'plan_id', title: '计划编号', width: 118 },
  { key: 'title', title: '标题' },
  { key: 'supplier', title: '目标供应商', width: 160 },
  { key: 'rate', title: '目标减排率', width: 100, align: 'right' },
  { key: 'progress', title: '进度', width: 150 },
  { key: 'status', title: '状态', width: 88 },
  { key: 'deadline', title: '截止日期', width: 104 },
]

function supplierName(
  suppliers: SupplierRecord[],
  supplierId: string | null,
): string {
  if (supplierId === null) return '—'
  return suppliers.find((item) => item.supplier_id === supplierId)?.name ?? supplierId
}

/** 减排计划表：进度用 2px 细线表达，状态文案 + 颜色双重表达 */
export default function ReductionPlanTable({
  plans,
  suppliers,
}: {
  plans: ReductionPlanRecord[]
  suppliers: SupplierRecord[]
}) {
  const rows = plans.map((plan) => {
    const percent = Math.min(Math.max(plan.progress * 100, 0), 100)
    return {
      _key: plan.plan_id,
      plan_id: <span className="sc-cell-id">{plan.plan_id}</span>,
      title: <span className="sc-cell-name">{plan.title}</span>,
      supplier: supplierName(suppliers, plan.target_supplier_id),
      rate: <span className="num">{formatPercent(plan.target_reduction_rate)}</span>,
      progress: (
        <div className="sc-progress">
          <span className="sc-progress__track" aria-hidden="true">
            <span className="sc-progress__bar" style={{ width: `${percent}%` }} />
          </span>
          <span className="sc-progress__text num">{formatPercent(plan.progress)}</span>
        </div>
      ),
      status: (
        <StatusText tone={planStatusTone(plan.status)}>
          {planStatusLabel(plan.status)}
        </StatusText>
      ),
      deadline: plan.deadline ?? '—',
    }
  })

  return (
    <SwissTable
      columns={COLUMNS}
      rows={rows}
      rowKey={(row) => String(row._key)}
      empty="暂无减排计划"
    />
  )
}
