import { Link } from 'react-router-dom'
import { SwissButton } from '../../../components/swiss'
import type { ReportFormat } from '../../../api/types'
import './ReportToolbar.css'

type ReportToolbarProps = {
  reportNo: string
  typeLabel: string
  downloading: ReportFormat | null
  error: string | null
  onPrint: () => void
  onDownload: (format: ReportFormat) => void
}

/** 报告详情工具栏：返回、打印、下载；打印时整块隐藏 */
export default function ReportToolbar({
  reportNo,
  typeLabel,
  downloading,
  error,
  onPrint,
  onDownload,
}: ReportToolbarProps) {
  const busy = downloading !== null

  return (
    <div className="report-toolbar">
      <div className="report-toolbar__main">
        <Link className="report-toolbar__back" to="/reports">
          ← 报告中心
        </Link>
        <div className="report-toolbar__meta">
          <span className="report-toolbar__kicker">
            报告预览 · {typeLabel} · A4
          </span>
          <span className="report-toolbar__no">{reportNo}</span>
        </div>
      </div>

      <div className="report-toolbar__actions">
        <SwissButton variant="ghost" onClick={onPrint}>
          打印
        </SwissButton>
        <SwissButton
          variant="ghost"
          onClick={() => onDownload('xml')}
          loading={downloading === 'xml'}
          disabled={busy && downloading !== 'xml'}
        >
          下载 XML
        </SwissButton>
        <SwissButton
          onClick={() => onDownload('pdf')}
          loading={downloading === 'pdf'}
          disabled={busy && downloading !== 'pdf'}
        >
          下载 PDF
        </SwissButton>
      </div>

      {error ? (
        <p className="report-toolbar__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
