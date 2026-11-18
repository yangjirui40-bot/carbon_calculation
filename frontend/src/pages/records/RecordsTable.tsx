import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { SwissButton, SwissTable, type SwissTableColumn } from '../../components/swiss'
import type { BusinessRecord, CompanyDetail } from '../../api/types'
import { formatAmount, formatNumber } from '../../utils/format'
import {
  categoryLabel,
  reviewStatusLabel,
  reviewStatusTone,
  scopeLabel,
  sourceLabel,
} from './constants'

type RecordsTableProps = {
  records: BusinessRecord[]
  companies: CompanyDetail[]
  /** 管理员/审计员查看“全部企业”时补一列企业，避免跨企业混排失去上下文 */
  showCompany: boolean
  canWrite: boolean
  pendingDeleteNo: string | null
  deleting: boolean
  onRequestDelete: (recordNo: string) => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
  emptyText: string
}

/** 活动量与金额二选一显示；人民币走 formatAmount，其他币种保留原币种 */
function renderValue(record: BusinessRecord): ReactNode {
  if (record.amount != null) {
    if (!record.currency || record.currency === 'CNY') {
      return <span className="records-number">{formatAmount(record.amount)}</span>
    }
    return (
      <span className="records-number">
        {formatNumber(record.amount, 2)} {record.currency}
      </span>
    )
  }
  if (record.quantity != null) {
    return (
      <span className="records-number">
        {formatNumber(record.quantity, 2)}
        {record.unit ? ` ${record.unit}` : ''}
      </span>
    )
  }
  return '—'
}

export default function RecordsTable({
  records,
  companies,
  showCompany,
  canWrite,
  pendingDeleteNo,
  deleting,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
  emptyText,
}: RecordsTableProps) {
  const columns: SwissTableColumn[] = [{ key: 'record_no', title: '记录编号' }]
  if (showCompany) columns.push({ key: 'company_name', title: '企业' })
  columns.push(
    { key: 'period', title: '期间' },
    { key: 'category', title: '类别' },
    { key: 'scope', title: 'Scope' },
    { key: 'value', title: '活动量 / 金额', align: 'right' },
    { key: 'factor_id', title: '因子' },
    { key: 'review_status', title: '复核状态' },
    { key: 'source', title: '来源' },
    { key: 'document', title: '关联单据' },
  )
  if (canWrite) columns.push({ key: 'actions', title: '操作', align: 'right' })

  const companyNames = new Map(companies.map((company) => [company.id, company.name]))

  const rows: Array<Record<string, ReactNode>> = records.map((record) => {
    const tone = reviewStatusTone(record.review_status)
    const pending = pendingDeleteNo === record.record_no

    const row: Record<string, ReactNode> = {
      key: record.record_no,
      record_no: record.record_no,
      company_name: companyNames.get(record.company_id) ?? `#${record.company_id}`,
      period: record.period,
      category: categoryLabel(record.category),
      scope: scopeLabel(record.scope),
      value: renderValue(record),
      factor_id: record.factor_id,
      review_status: (
        <span className={`records-status records-status--${tone}`}>
          {reviewStatusLabel(record.review_status)}
        </span>
      ),
      source: sourceLabel(record.source),
      document:
        record.document_id != null ? (
          <Link
            className="records-doc-link"
            to={`/documents/${record.document_id}/review`}
          >
            #{record.document_id} 核对
          </Link>
        ) : (
          '—'
        ),
    }

    if (canWrite) {
      row.actions = pending ? (
        <span className="records-delete-confirm">
          <span className="records-delete-hint">确认删除？</span>
          <SwissButton
            variant="danger"
            className="records-row-action"
            onClick={onConfirmDelete}
            loading={deleting}
            autoFocus
            aria-label={`确认删除记录 ${record.record_no}`}
          >
            删除
          </SwissButton>
          <SwissButton
            variant="ghost"
            className="records-row-action"
            onClick={onCancelDelete}
            disabled={deleting}
            aria-label={`取消删除记录 ${record.record_no}`}
          >
            取消
          </SwissButton>
        </span>
      ) : (
        <SwissButton
          variant="ghost"
          className="records-row-action"
          onClick={() => onRequestDelete(record.record_no)}
          aria-label={`删除记录 ${record.record_no}`}
        >
          删除
        </SwissButton>
      )
    }

    return row
  })

  return (
    <SwissTable
      columns={columns}
      rows={rows}
      rowKey={(row) => String(row.key)}
      empty={emptyText}
    />
  )
}
