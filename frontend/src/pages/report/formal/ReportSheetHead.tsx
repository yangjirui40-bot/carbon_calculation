import './ReportSheetHead.css'

type ReportSheetHeadProps = {
  brand: string
  meta: string
}

/** 报告纸页眉：左侧报告类别，右侧报告编号与标准 */
export default function ReportSheetHead({ brand, meta }: ReportSheetHeadProps) {
  return (
    <header className="formal-head">
      <b>{brand}</b>
      <span>{meta}</span>
    </header>
  )
}
