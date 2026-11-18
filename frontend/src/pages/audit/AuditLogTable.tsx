import { Link } from 'react-router-dom'
import type { AuditLogEntry } from '../../api/types'
import { SwissTable, type SwissTableColumn } from '../../components/swiss'
import { EMPTY_VALUE, formatDateTime } from '../../utils/format'
import { actorText, statusCodeOf } from './auditFormat'

export type AuditLogTableProps = {
  logs: AuditLogEntry[]
  filtered: boolean
}

/** 审计日志表：动作过长时截断，title 暴露全文；运行编号可跳穿透页 */
export default function AuditLogTable({ logs, filtered }: AuditLogTableProps) {
  const columns: SwissTableColumn[] = [
    {
      key: 'id',
      title: '编号',
      width: 64,
      render: (row) => row.id,
    },
    {
      key: 'action',
      title: '动作',
      render: (row) => (
        <span className="audit-action" title={String(row.action ?? '')}>
          {row.action}
        </span>
      ),
    },
    {
      key: 'actor',
      title: '操作人',
      width: 88,
      render: (row) => row.actor,
    },
    {
      key: 'ip',
      title: '来源 IP',
      width: 118,
      render: (row) => row.ip,
    },
    {
      key: 'status',
      title: '状态码',
      width: 70,
      align: 'right',
      render: (row) => row.status,
    },
    {
      key: 'time',
      title: '时间',
      width: 148,
      render: (row) => row.time,
    },
    {
      key: 'run',
      title: '运行编号',
      width: 190,
      render: (row) => row.run,
    },
  ]

  const rows = logs.map((log) => ({
    id: <span className="audit-mono">{log.id}</span>,
    action: log.action,
    actor: <span className="audit-mono">{actorText(log.actor_user_id)}</span>,
    ip: <span className="audit-mono">{log.source_ip ?? EMPTY_VALUE}</span>,
    status: <span className="audit-mono">{statusCodeOf(log.detail)}</span>,
    time: <span className="audit-mono">{formatDateTime(log.created_at)}</span>,
    run: log.run_id ? (
      <Link
        className="audit-run-link"
        to={`/audit/runs/${encodeURIComponent(log.run_id)}`}
        title={`查看 ${log.run_id} 的穿透与存证`}
      >
        {log.run_id}
      </Link>
    ) : (
      EMPTY_VALUE
    ),
  }))

  return (
    <SwissTable
      columns={columns}
      rows={rows}
      rowKey={(_, index) => String(logs[index]?.id ?? index)}
      empty={
        filtered
          ? '该运行编号下没有审计日志，可清空筛选查看全部。'
          : '暂无审计日志。'
      }
    />
  )
}
