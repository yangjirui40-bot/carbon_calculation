import type { CalculationRunDetail } from '../../../api/types'
import { formatDateTime } from '../../../utils/format'
import { operationLabel, runStatusLabel } from '../text'
import './RunMetaList.css'

type RunMetaListProps = {
  run: CalculationRunDetail
}

/** 非企业结果或失败任务：只展示运行元数据，不套用企业结果布局。 */
export default function RunMetaList({ run }: RunMetaListProps) {
  const rows: Array<{ label: string; value: string }> = [
    { label: '运行编号', value: run.run_id },
    { label: '操作', value: operationLabel(run.operation) },
    { label: '状态', value: runStatusLabel(run.status) },
    { label: '企业编号', value: run.company_id === null ? '—' : String(run.company_id) },
    ...(run.product_id
      ? [{ label: '产品编号', value: run.product_id }]
      : []),
    { label: '算法版本', value: run.algorithm_version || '—' },
    {
      label: '因子版本',
      value:
        run.factor_versions && run.factor_versions.length > 0
          ? run.factor_versions.join('、')
          : '—',
    },
    { label: '创建时间', value: formatDateTime(run.created_at) },
  ]

  return (
    <dl className="run-meta">
      {rows.map((row) => (
        <div className="run-meta__row" key={row.label}>
          <dt>{row.label}</dt>
          <dd className={row.label === '运行编号' ? 'run-meta__mono' : undefined}>
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
