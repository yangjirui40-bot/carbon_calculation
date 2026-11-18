import type { AuditTrace } from '../../api/types'
import {
  SwissSection,
  SwissTable,
  type SwissTableColumn,
} from '../../components/swiss'
import { EMPTY_VALUE, formatDateTime, formatNumber } from '../../utils/format'
import {
  activityText,
  categoryLabel,
  docTypeLabel,
  parseStatusLabel,
  sanitizeOrigin,
  scopeLabel,
} from './auditFormat'

const factorColumns: SwissTableColumn[] = [
  { key: 'factor_id', title: '因子编号' },
  { key: 'category', title: '类别' },
  { key: 'value', title: '数值', align: 'right' },
  { key: 'unit', title: '单位' },
  { key: 'version', title: '版本' },
  { key: 'origin', title: '来源' },
]

const recordColumns: SwissTableColumn[] = [
  { key: 'record_no', title: '记录编号' },
  { key: 'period', title: '期间', width: 84 },
  { key: 'category', title: '类别' },
  { key: 'scope', title: 'Scope', width: 76 },
  { key: 'activity', title: '活动量 / 金额', align: 'right' },
  { key: 'emissions', title: '排放量（kgCO₂e）', align: 'right' },
]

const documentColumns: SwissTableColumn[] = [
  { key: 'file_name', title: '文件名' },
  { key: 'doc_type', title: '类型', width: 110 },
  { key: 'parse_status', title: '解析状态', width: 90 },
  { key: 'ocr_engine', title: '识别引擎', width: 130 },
]

/** 穿透核查：因子、明细记录、关联单据与运行审计日志时间线 */
export default function TraceSections({ trace }: { trace: AuditTrace }) {
  const factors = trace.factors ?? []
  const records = trace.records ?? []
  const documents = trace.documents ?? []
  const auditLogs = trace.audit_logs ?? []

  const factorRows = factors.map((factor) => ({
    factor_id: <span className="audit-mono">{factor.factor_id}</span>,
    category: categoryLabel(factor.category),
    value: (
      <span className="audit-mono audit-number">
        {formatNumber(factor.value, 6)}
      </span>
    ),
    unit: factor.unit,
    version: <span className="audit-mono">{factor.version}</span>,
    origin: (
      <span className="audit-origin" title={sanitizeOrigin(factor.origin)}>
        {sanitizeOrigin(factor.origin)}
      </span>
    ),
  }))

  const recordRows = records.map((record) => ({
    record_no: <span className="audit-mono">{record.record_no}</span>,
    period: <span className="audit-mono">{record.period || EMPTY_VALUE}</span>,
    category: categoryLabel(record.category),
    scope: scopeLabel(record.scope),
    activity: (
      <span className="audit-mono audit-number">
        {activityText(record.quantity, record.amount)}
      </span>
    ),
    emissions: (
      <span className="audit-mono audit-number">
        {formatNumber(record.emissions_kgco2e, 2)}
      </span>
    ),
  }))

  const documentRows = documents.map((document) => ({
    file_name: document.file_name,
    doc_type: docTypeLabel(document.doc_type),
    parse_status: parseStatusLabel(document.parse_status),
    ocr_engine: document.ocr_engine ? (
      <span className="audit-mono">{document.ocr_engine}</span>
    ) : (
      EMPTY_VALUE
    ),
  }))

  return (
    <>
      <SwissSection
        kicker="Trace / Factors"
        title="因子清单"
        extra={`${factors.length} 项`}
      >
        <SwissTable
          columns={factorColumns}
          rows={factorRows}
          rowKey={(_, index) => `factor-${factors[index]?.factor_id ?? index}`}
          empty="本次运行没有关联到排放因子。"
        />
      </SwissSection>

      <SwissSection
        kicker="Trace / Records"
        title="记录清单"
        extra={`${records.length} 条`}
      >
        <SwissTable
          columns={recordColumns}
          rows={recordRows}
          rowKey={(_, index) => `record-${records[index]?.record_no ?? index}`}
          empty="本次运行没有明细记录。"
        />
      </SwissSection>

      <SwissSection
        kicker="Trace / Documents"
        title="关联单据"
        extra={`${documents.length} 份`}
      >
        <SwissTable
          columns={documentColumns}
          rows={documentRows}
          rowKey={(_, index) => `document-${documents[index]?.id ?? 'x'}-${index}`}
          empty="本次运行没有关联单据。"
        />
      </SwissSection>

      <SwissSection
        kicker="Trace / Logs"
        title="审计日志时间线"
        extra={`${auditLogs.length} 条`}
      >
        {auditLogs.length === 0 ? (
          <div className="audit-state" role="status">
            暂无针对本次运行的审计日志。
          </div>
        ) : (
          <ol className="audit-timeline" role="list">
            {auditLogs.map((entry, index) => (
              <li
                className="audit-timeline__item"
                key={`${entry.created_at}-${index}`}
              >
                <span className="audit-timeline__time audit-mono">
                  {formatDateTime(entry.created_at)}
                </span>
                <span className="audit-timeline__action">{entry.action}</span>
                <span className="audit-timeline__actor">
                  {entry.actor_user_id === null
                    ? EMPTY_VALUE
                    : `用户 #${entry.actor_user_id}`}
                </span>
              </li>
            ))}
          </ol>
        )}
      </SwissSection>
    </>
  )
}
