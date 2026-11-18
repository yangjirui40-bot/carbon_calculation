import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { companiesApi, documentsApi } from '../../api'
import { ApiRequestError } from '../../api/client'
import { readSession } from '../../api/modules/auth'
import type {
  BusinessRecord,
  CompanyDetail,
  ReviewQueueItem,
  SourceDocument,
} from '../../api/types'
import { useCompany } from '../../context/CompanyContext'
import DocumentsList from './swiss/DocumentsList'
import DocumentsUploadPanel from './swiss/DocumentsUploadPanel'
import LocalRecords from './LocalRecords'
import ManualEntrySheet from './ManualEntrySheet'
import './DocumentsPage.css'

/** 单据管理采用方案 2 · 上传工作区，数据来自 /api/v1/documents */
export default function DocumentsPage() {
  const session = readSession()
  const role = session?.user.role
  const sessionCompanyId = session?.user.company_id ?? null
  const canSwitchCompany = role === 'admin' || role === 'auditor'

  const { companyId: contextCompanyId, setCompanyId } = useCompany()

  const [companies, setCompanies] = useState<CompanyDetail[]>([])
  const [documents, setDocuments] = useState<SourceDocument[]>([])
  const [queue, setQueue] = useState<ReviewQueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [parsingId, setParsingId] = useState<number | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [records, setRecords] = useState<BusinessRecord[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const loadSeq = useRef(0)

  useEffect(() => {
    if (!canSwitchCompany) return
    let ignore = false
    companiesApi
      .listCompanies()
      .then((list) => {
        if (!ignore) setCompanies(list)
      })
      .catch(() => {
        // 企业列表失败时退回会话里的企业；选择器显示为空
      })
    return () => {
      ignore = true
    }
  }, [canSwitchCompany])

  /** 企业角色固定用会话企业；admin/auditor 用顶部选择，未选时默认第一家 */
  const effectiveCompanyId = useMemo(() => {
    if (!canSwitchCompany) return sessionCompanyId
    if (
      contextCompanyId &&
      (companies.length === 0 || companies.some((company) => company.id === contextCompanyId))
    ) {
      return contextCompanyId
    }
    return companies[0]?.id ?? null
  }, [canSwitchCompany, sessionCompanyId, contextCompanyId, companies])

  const reload = useCallback(async () => {
    if (!effectiveCompanyId) {
      setDocuments([])
      setQueue([])
      setLoading(false)
      return
    }
    const seq = ++loadSeq.current
    setLoading(true)
    setError(null)
    try {
      const [docs, queueResult] = await Promise.all([
        documentsApi.listDocuments({ company_id: effectiveCompanyId }),
        documentsApi.getReviewQueue({ company_id: effectiveCompanyId }),
      ])
      if (seq !== loadSeq.current) return
      setDocuments(docs)
      setQueue(queueResult.queue)
    } catch (err) {
      if (seq !== loadSeq.current) return
      setError(err instanceof ApiRequestError ? err.message : '单据加载失败，请稍后重试')
    } finally {
      if (seq === loadSeq.current) setLoading(false)
    }
  }, [effectiveCompanyId])

  useEffect(() => {
    void reload()
  }, [reload])

  const handleParse = useCallback(
    async (doc: SourceDocument) => {
      setParsingId(doc.id)
      setActionError(null)
      setNotice(null)
      try {
        await documentsApi.parseDocument(doc.id, true)
        setNotice(`${doc.file_name} 识别完成`)
        await reload()
      } catch (err) {
        setActionError(
          err instanceof ApiRequestError ? err.message : '解析失败，请稍后重试',
        )
      } finally {
        setParsingId(null)
      }
    },
    [reload],
  )

  const handleUploaded = useCallback(
    (doc: SourceDocument) => {
      setActionError(null)
      setNotice(
        doc.overall_confidence === null
          ? `${doc.file_name} 已上传并解析`
          : `${doc.file_name} 已上传并解析 · 综合置信度 ${doc.overall_confidence.toFixed(2)}`,
      )
      void reload()
    },
    [reload],
  )

  const handleCompanyChange = (value: string) => {
    const next = Number(value)
    if (Number.isFinite(next)) setCompanyId(next)
  }

  const companyName =
    companies.find((company) => company.id === effectiveCompanyId)?.name ?? null

  return (
    <div className="doc-swiss">
      <div className="doc-wrap">
        <main>
          <div className="doc-page-head">
            <div>
              <h1>单据管理</h1>
              <p>上传票据、跟踪解析状态，并进入需要人工核对的单据。</p>
            </div>
            <div className="doc-head-side">
              {canSwitchCompany ? (
                companies.length > 0 ? (
                  <label className="doc-company">
                    <span>当前企业</span>
                    <select
                      value={effectiveCompanyId ?? ''}
                      onChange={(event) => handleCompanyChange(event.target.value)}
                    >
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <span className="doc-company-empty">暂无可用企业</span>
                )
              ) : companyName ? (
                <span className="doc-company-empty">{companyName}</span>
              ) : null}
              <Link className="doc-back" to="/workspace">
                返回工作台 →
              </Link>
            </div>
          </div>

          {notice ? (
            <div className="doc-notice">
              <span className="doc-notice-dot" aria-hidden="true" />
              {notice}
            </div>
          ) : null}
          {actionError ? (
            <div className="doc-notice is-error" role="alert">
              {actionError}
            </div>
          ) : null}

          <div className="doc-grid">
            <DocumentsUploadPanel
              companyId={effectiveCompanyId}
              onManual={() => setDrawerOpen(true)}
              onUploaded={handleUploaded}
            />
            <DocumentsList
              documents={documents}
              queue={queue}
              loading={loading}
              error={error}
              parsingId={parsingId}
              onRetry={reload}
              onParse={handleParse}
              onManual={() => setDrawerOpen(true)}
            />
          </div>

          <LocalRecords records={records} />
        </main>
      </div>

      <ManualEntrySheet
        open={drawerOpen}
        companyId={effectiveCompanyId}
        onClose={() => setDrawerOpen(false)}
        onCreated={(record) => {
          setRecords((prev) => [record, ...prev])
          setNotice(`已写入业务记录：${record.remark ?? record.record_no}`)
        }}
      />
    </div>
  )
}
