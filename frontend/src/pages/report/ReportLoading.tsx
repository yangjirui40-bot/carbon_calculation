import './ReportLoading.css'

type ReportLoadingProps = {
  label: string
}

/** 报告页通用加载态：方形细线指示器 + 文字 */
export default function ReportLoading({ label }: ReportLoadingProps) {
  return (
    <div className="report-loading" role="status" aria-live="polite">
      <span className="report-loading__mark" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
