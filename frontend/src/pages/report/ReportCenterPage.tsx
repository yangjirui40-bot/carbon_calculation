import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { companiesApi, reportsApi } from '../../api'
import type { CompanyDetail, ReportSummary } from '../../api/types'
import {
  SwissButton,
  SwissEmpty,
  SwissError,
  SwissField,
  SwissMasthead,
  SwissSection,
  SwissSelect,
  SwissTable,
} from '../../components/swiss'
import type { SwissTableColumn } from '../../components/swiss'
import { useCompany } from '../../context/CompanyContext'
import { readSession } from '../../router/guards/RequireAuth'
import { displayText } from './reportContent'
import { toErrorMessage } from './reportErrors'
import {
  formatBackendDateTime,
  reportStatusLabel,
  reportTypeLabel,
} from './reportMeta'
import { saveReportFile } from './downloadReportFile'
import GenerateReportDrawer from './GenerateReportDrawer'
import ReportLoading from './ReportLoading'
import './ReportCenterPage.css'

const COLUMNS: SwissTableColumn[] = [
  { key: 'report_no', title: '报告编号', width: 190 },
  { key: 'type', title: '类型', width: 96 },
  { key: 'title', title: '标题' },
  { key: 'status', title: '状态', width: 88 },
  { key: 'created_at', title: '生成时间', width: 142 },
  { key: 'actions', title: '操作', width: 208, align: 'right' },
]

/** 报告中心：真实报告列表 + 生成入口；页面在 SwissAppShell 内渲染 */
export default function ReportCenterPage() {
  const session = readSession()
  const fixedCompanyId = session?.user.company_id ?? null
  const needsCompanyPicker = fixedCompanyId === null
  const { companyId: storedCompanyId, setCompanyId } = useCompany()
  const companyId = fixedCompanyId ?? storedCompanyId

  const [companies, setCompanies] = useState<CompanyDetail[]>([])
  const [companiesLoading, setCompaniesLoading] = useState(needsCompanyPicker)
  const [companiesError, setCompaniesError] = useState<string | null>(null)

  const [reports, setReports] = useState<ReportSummary[] | null>(null)
  const [reportsLoading, setReportsLoading] = useState(true)
  const [reportsError, setReportsError] = useState<string | null>(null)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const companiesRequestId = useRef(0)
  const reportsRequestId = useRef(0)

  const loadCompanies = useCallback(async () => {
    if (!needsCompanyPicker) return
    const requestId = ++companiesRequestId.current
    setCompaniesLoading(true)
    setCompaniesError(null)
    try {
      const data = await companiesApi.listCompanies()
      if (requestId !== companiesRequestId.current) return
      setCompanies(data)
    } catch (error) {
      if (requestId !== companiesRequestId.current) return
      setCompanies([])
      setCompaniesError(toErrorMessage(error, '企业列表加载失败，请重试'))
    } finally {
      if (requestId === companiesRequestId.current) setCompaniesLoading(false)
    }
  }, [needsCompanyPicker])

  const loadReports = useCallback(async () => {
    const requestId = ++reportsRequestId.current
    setReportsLoading(true)
    setReportsError(null)
    setActionError(null)
    try {
      const data = await reportsApi.listReports(
        companyId === null ? {} : { company_id: companyId },
      )
      if (requestId !== reportsRequestId.current) return
      setReports(data)
    } catch (error) {
      if (requestId !== reportsRequestId.current) return
      setReports(null)
      setReportsError(toErrorMessage(error, '报告列表加载失败，请重试'))
    } finally {
      if (requestId === reportsRequestId.current) setReportsLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    void loadCompanies()
  }, [loadCompanies])

  // 本地保存的企业已不存在时回退到“全部企业”，避免空列表误判
  useEffect(() => {
    if (!needsCompanyPicker || companiesLoading || companiesError || companyId === null) return
    if (companies.some((company) => company.id === companyId)) return
    setCompanyId(null)
  }, [needsCompanyPicker, companies, companiesLoading, companiesError, companyId, setCompanyId])

  useEffect(() => {
    void loadReports()
  }, [loadReports])

  const handleCompanyChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value
    setCompanyId(value ? Number(value) : null)
  }

  const handleDownload = async (reportNo: string, format: 'pdf' | 'xml') => {
    setDownloading(`${reportNo}:${format}`)
    setActionError(null)
    try {
      await saveReportFile(reportNo, format)
    } catch (error) {
      setActionError(toErrorMessage(error, '下载失败，请稍后重试'))
    } finally {
      setDownloading(null)
    }
  }

  const rows = (reports ?? []).map((report) => {
    const pdfKey = `${report.report_no}:pdf`
    const xmlKey = `${report.report_no}:xml`
    const downloadingPdf = downloading === pdfKey
    const downloadingXml = downloading === xmlKey
    const statusTone = report.status === 'generated' ? 'done' : 'muted'

    return {
      _key: report.report_no,
      report_no: <span className="report-center__no">{report.report_no}</span>,
      type: reportTypeLabel(report.report_type),
      title: displayText(report.title) ?? '—',
      status: (
        <span className={`report-center__status report-center__status--${statusTone}`}>
          <span className="report-center__status-dot" aria-hidden="true" />
          {reportStatusLabel(report.status)}
        </span>
      ),
      created_at: <span className="num">{formatBackendDateTime(report.created_at)}</span>,
      actions: (
        <div className="report-center__actions">
          <Link
            className="report-center__action"
            to={`/reports/${encodeURIComponent(report.report_no)}`}
            aria-label={`查看报告 ${report.report_no}`}
          >
            查看
          </Link>
          <button
            type="button"
            className="report-center__action"
            onClick={() => void handleDownload(report.report_no, 'pdf')}
            disabled={downloading !== null}
            aria-busy={downloadingPdf || undefined}
            aria-label={`下载报告 ${report.report_no} 的 PDF`}
          >
            {downloadingPdf ? 'PDF 下载中…' : '下载 PDF'}
          </button>
          <button
            type="button"
            className="report-center__action"
            onClick={() => void handleDownload(report.report_no, 'xml')}
            disabled={downloading !== null}
            aria-busy={downloadingXml || undefined}
            aria-label={`下载报告 ${report.report_no} 的 XML`}
          >
            {downloadingXml ? 'XML 下载中…' : '下载 XML'}
          </button>
        </div>
      ),
    }
  })

  return (
    <div className="report-center">
      <SwissMasthead
        kicker="报告"
        title="报告中心"
        description="集中查看、生成与下载 ISO 14064 盘查清单和 ISO 14067 产品碳足迹报告。"
        actions={
          <SwissButton onClick={() => setDrawerOpen(true)}>生成报告</SwissButton>
        }
      />

      {needsCompanyPicker ? (
        <div className="report-center__filters">
          <SwissField
            label="企业"
            htmlFor="report-center-company"
            hint="选择企业后，列表与生成选项按该企业过滤；也可查看全部企业。"
          >
            <SwissSelect
              id="report-center-company"
              value={companyId === null ? '' : String(companyId)}
              onChange={handleCompanyChange}
              disabled={companiesLoading}
            >
              <option value="">全部企业</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {displayText(company.name)}
                </option>
              ))}
            </SwissSelect>
          </SwissField>

          {companiesLoading ? (
            <span className="report-center__filter-note" role="status">
              正在加载企业…
            </span>
          ) : null}
          {companiesError ? (
            <span className="report-center__filter-error" role="alert">
              {companiesError}
              <button
                type="button"
                className="report-center__action"
                onClick={() => void loadCompanies()}
              >
                重试
              </button>
            </span>
          ) : null}
        </div>
      ) : null}

      <SwissSection
        kicker="Reports"
        title="报告记录"
        extra={reports ? `共 ${reports.length} 份` : undefined}
      >
        {reportsLoading ? (
          <ReportLoading label="正在加载报告…" />
        ) : reportsError ? (
          <SwissError
            message={reportsError}
            onRetry={() => void loadReports()}
            backTo={{ to: '/calculations', label: '核算中心' }}
          />
        ) : reports && reports.length > 0 ? (
          <>
            {actionError ? (
              <p className="report-center__action-error" role="alert">
                {actionError}
              </p>
            ) : null}
            <SwissTable
              columns={COLUMNS}
              rows={rows}
              rowKey={(row) => String(row._key)}
            />
          </>
        ) : (
          <SwissEmpty
            title="还没有报告"
            description="完成一次企业核算或产品核算后，可在这里生成盘查清单与产品碳足迹报告。"
            action={
              <Link className="report-center__empty-link" to="/calculations">
                去核算中心 →
              </Link>
            }
          />
        )}
      </SwissSection>

      <GenerateReportDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        companyId={companyId}
        companies={companies}
        companiesLoading={companiesLoading}
        onCompanyChange={setCompanyId}
      />
    </div>
  )
}
