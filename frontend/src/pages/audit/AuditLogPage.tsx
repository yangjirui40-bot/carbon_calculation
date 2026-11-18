import { App } from 'antd'
import { useEffect, useState } from 'react'
import { auditApi } from '../../api'
import type { AuditLogEntry } from '../../api/types'
import {
  SwissError,
  SwissMasthead,
  SwissSection,
} from '../../components/swiss'
import AuditLogFilters from './AuditLogFilters'
import AuditLogTable from './AuditLogTable'
import { downloadAuditLogJson } from './auditExport'
import { errorMessage } from './auditFormat'
import './audit.css'

const DEFAULT_LIMIT = 100

/** 审计日志：按运行编号筛选真实日志，导出 JSON 响应体为文件。 */
export default function AuditLogPage() {
  const { message } = App.useApp()
  const [draftRunId, setDraftRunId] = useState('')
  const [runId, setRunId] = useState('')
  const [limit, setLimit] = useState<number>(DEFAULT_LIMIT)
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [token, setToken] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    auditApi
      .listLogs({ limit, ...(runId ? { run_id: runId } : {}) })
      .then((list) => {
        if (active) setLogs(list)
      })
      .catch((loadError: unknown) => {
        if (!active) return
        setLogs([])
        setError(errorMessage(loadError))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [runId, limit, token])

  const applyFilter = () => {
    setRunId(draftRunId.trim())
  }

  const resetFilter = () => {
    setDraftRunId('')
    setRunId('')
    setLimit(DEFAULT_LIMIT)
    setExportError('')
  }

  const handleExport = async () => {
    setExporting(true)
    setExportError('')
    try {
      const body = await auditApi.exportAuditLog(runId || undefined)
      const fileName = downloadAuditLogJson(body.logs)
      message.success(`已导出 ${body.logs.length} 条审计日志（${fileName}）`)
    } catch (exportFailure: unknown) {
      setExportError(errorMessage(exportFailure))
    } finally {
      setExporting(false)
    }
  }

  const extra = loading
    ? '加载中…'
    : error
      ? '加载失败'
      : runId
        ? `运行 ${runId} · ${logs.length} 条`
        : `${logs.length} 条`

  return (
    <div className="audit-page">
      <SwissMasthead
        kicker="审计 / Audit"
        title="审计日志"
        description="查询操作与 API 请求日志，按运行编号追溯，并导出 JSON。"
      />

      <SwissSection kicker="Filter" title="筛选条件">
        <AuditLogFilters
          draftRunId={draftRunId}
          limit={limit}
          loading={loading}
          exporting={exporting}
          canReset={draftRunId !== '' || runId !== '' || limit !== DEFAULT_LIMIT}
          exportError={exportError}
          onDraftRunIdChange={setDraftRunId}
          onLimitChange={setLimit}
          onApply={applyFilter}
          onReset={resetFilter}
          onExport={() => {
            void handleExport()
          }}
        />
      </SwissSection>

      <SwissSection kicker="Logs" title="日志明细" extra={extra}>
        {loading ? (
          <div className="audit-state" role="status" aria-busy="true">
            正在加载审计日志…
          </div>
        ) : error ? (
          <SwissError
            message={error}
            onRetry={() => setToken((value) => value + 1)}
          />
        ) : (
          <AuditLogTable logs={logs} filtered={Boolean(runId)} />
        )}
      </SwissSection>
    </div>
  )
}
