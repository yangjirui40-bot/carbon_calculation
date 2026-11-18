import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { reportsApi } from '../../api'
import type { ReportDetail, ReportFormat } from '../../api/types'
import { SwissEmpty, SwissError } from '../../components/swiss'
import { isNotFoundError, toErrorMessage } from './reportErrors'
import { isReportNotFound, readIsoContent, readPcfContent } from './reportContent'
import { reportTypeLabel } from './reportMeta'
import { saveReportFile } from './downloadReportFile'
import ReportLoading from './ReportLoading'
import Iso14064Sheet from './formal/Iso14064Sheet'
import PcfSheet from './formal/PcfSheet'
import ReportToolbar from './formal/ReportToolbar'
import './ReportPage.css'

/** 报告详情：/reports/:reportNo，按 ISO14064 / PCF 渲染正式报告纸面 */
export default function ReportPage() {
  const { reportNo } = useParams<{ reportNo: string }>()
  const [report, setReport] = useState<ReportDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<ReportFormat | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const requestId = useRef(0)

  const loadReport = useCallback(async () => {
    if (!reportNo) {
      setLoading(false)
      setMissing(true)
      setReport(null)
      setError(null)
      return
    }

    const currentRequest = ++requestId.current
    setLoading(true)
    setMissing(false)
    setError(null)
    setDownloading(null)
    setDownloadError(null)

    try {
      const data = await reportsApi.getReport(reportNo)
      if (currentRequest !== requestId.current) return
      if (isReportNotFound(data)) {
        setMissing(true)
        setReport(null)
      } else {
        setReport(data)
      }
    } catch (loadError) {
      if (currentRequest !== requestId.current) return
      setReport(null)
      if (isNotFoundError(loadError)) {
        setMissing(true)
      } else {
        setError(toErrorMessage(loadError, '报告加载失败，请稍后重试'))
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false)
    }
  }, [reportNo])

  useEffect(() => {
    void loadReport()
  }, [loadReport])

  const handleDownload = async (format: ReportFormat) => {
    if (!report) return
    setDownloading(format)
    setDownloadError(null)
    try {
      await saveReportFile(report.report_no, format)
    } catch (downloadFailure) {
      setDownloadError(toErrorMessage(downloadFailure, '下载失败，请稍后重试'))
    } finally {
      setDownloading(null)
    }
  }

  if (loading) {
    return (
      <div className="formal-report">
        <ReportLoading label="正在加载报告…" />
      </div>
    )
  }

  if (missing) {
    return (
      <div className="formal-report">
        <div className="formal-missing">
          <div className="formal-missing-kicker">Report / missing</div>
          <h1>找不到这份报告</h1>
          <p>报告编号不存在，或这份报告已被移除。</p>
          <Link className="formal-missing-link" to="/reports">
            返回报告中心 →
          </Link>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="formal-report">
        <div className="formal-state">
          <SwissError
            message={error}
            onRetry={() => void loadReport()}
            backTo={{ to: '/reports', label: '报告中心' }}
          />
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="formal-report">
        <div className="formal-state">
          <SwissEmpty
            title="报告未加载"
            description="没有拿到报告数据，请返回报告中心后重试。"
            action={
              <Link className="formal-missing-link" to="/reports">
                返回报告中心 →
              </Link>
            }
          />
        </div>
      </div>
    )
  }

  if (!report.content) {
    return (
      <div className="formal-report">
        <div className="formal-state">
          <SwissEmpty
            title="这份报告没有内容"
            description="报告记录存在，但内容为空。请返回报告中心重新生成。"
            action={
              <Link className="formal-missing-link" to="/reports">
                返回报告中心 →
              </Link>
            }
          />
        </div>
      </div>
    )
  }

  const isIso = report.report_type === 'ISO14064'
  const isPcf = report.report_type === 'PCF'

  if (!isIso && !isPcf) {
    return (
      <div className="formal-report">
        <div className="formal-state">
          <SwissEmpty
            title="暂不支持该报告类型"
            description={`报告类型 ${report.report_type || '未知'} 暂无可用的详情排版。`}
            action={
              <Link className="formal-missing-link" to="/reports">
                返回报告中心 →
              </Link>
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div className="formal-report">
      <ReportToolbar
        reportNo={report.report_no}
        typeLabel={reportTypeLabel(report.report_type)}
        downloading={downloading}
        error={downloadError}
        onPrint={() => window.print()}
        onDownload={(format) => void handleDownload(format)}
      />

      <div className="formal-pages">
        {isIso ? (
          <Iso14064Sheet report={report} content={readIsoContent(report.content)} />
        ) : (
          <PcfSheet report={report} content={readPcfContent(report.content)} />
        )}
      </div>
    </div>
  )
}
