import type { ReportDetail } from '../../../api/types'
import {
  EMISSION_UNIT,
  EMPTY_VALUE,
  formatAmount,
  formatDateTime,
  formatEmissionWithTonnes,
  formatNumber,
} from '../../../utils/format'
import {
  categoryLabel,
  displayText,
  type PcfReportContent,
} from '../reportContent'
import ReportSheetHead from './ReportSheetHead'
import './ReportSheet.css'

type PcfSheetProps = {
  report: ReportDetail
  content: PcfReportContent
}

/** ISO 14067 产品碳足迹报告 */
export default function PcfSheet({ report, content }: PcfSheetProps) {
  const standard = content.standard ?? 'ISO 14067:2018'
  const unitLabel = content.unitLabel ?? EMPTY_VALUE
  const outputText =
    content.outputQuantity === null
      ? EMPTY_VALUE
      : `${formatNumber(content.outputQuantity, 2)}${
          content.productUnit ? ` ${content.productUnit}` : ''
        }`

  return (
    <article className="formal-sheet" aria-label="ISO 14067 产品碳足迹报告">
      <ReportSheetHead
        brand="碳速算 · 产品碳足迹报告"
        meta={`报告编号 ${report.report_no} · ${standard}`}
      />

      <h1 className="formal-title">
        {displayText(report.title) ?? '产品碳足迹核查报告'}
      </h1>
      <p className="formal-subtitle">
        {content.productName ?? EMPTY_VALUE} · {content.productId ?? EMPTY_VALUE}
      </p>

      <table className="formal-meta">
        <tbody>
          <tr>
            <td className="label">产品名称</td>
            <td>{content.productName ?? EMPTY_VALUE}</td>
            <td className="label">产品编号</td>
            <td>{content.productId ?? EMPTY_VALUE}</td>
          </tr>
          <tr>
            <td className="label">参考产出</td>
            <td>{outputText}</td>
            <td className="label">核算标准</td>
            <td>{standard}</td>
          </tr>
          <tr>
            <td className="label">报告编号</td>
            <td>{report.report_no}</td>
            <td className="label">运行编号</td>
            <td>{report.run_id ?? EMPTY_VALUE}</td>
          </tr>
          <tr>
            <td className="label">生成时间</td>
            <td colSpan={3}>{formatDateTime(content.generatedAt)}</td>
          </tr>
        </tbody>
      </table>

      <section className="formal-section">
        <h2>一、结果摘要</h2>
        <div className="formal-stats">
          <div className="formal-stat">
            <span className="formal-stat__label">上游总排放</span>
            <b className="formal-stat__value">
              {formatEmissionWithTonnes(content.totalUpstreamKg)}
            </b>
          </div>
          <div className="formal-stat">
            <span className="formal-stat__label">单位产品排放</span>
            <b className="formal-stat__value">
              {formatNumber(content.unitProductKg, 4)}
              <small>{unitLabel}</small>
            </b>
          </div>
        </div>
      </section>

      <section className="formal-section formal-section--table">
        <h2>二、排放明细</h2>
        <table className="formal-table">
          <colgroup>
            <col style={{ width: '20%' }} />
            <col style={{ width: '19%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '17%' }} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">物料名称</th>
              <th scope="col">业务类别</th>
              <th scope="col" className="right">采购金额</th>
              <th scope="col">因子编号</th>
              <th scope="col">版本</th>
              <th scope="col" className="right">排放量（{EMISSION_UNIT}）</th>
            </tr>
          </thead>
          <tbody>
            {content.items.length === 0 ? (
              <tr>
                <td className="formal-table__empty" colSpan={6}>
                  暂无排放明细
                </td>
              </tr>
            ) : (
              content.items.map((item, index) => (
                <tr key={`${item.bomItemId ?? 'bom'}-${index}`}>
                  <td>{item.materialName ?? EMPTY_VALUE}</td>
                  <td>{categoryLabel(item.category)}</td>
                  <td className="right num">{formatAmount(item.materialAmountCny)}</td>
                  <td className="num">{item.factorId ?? EMPTY_VALUE}</td>
                  <td className="num">{item.factorVersion ?? EMPTY_VALUE}</td>
                  <td className="right num">{formatNumber(item.emissionsKg, 2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="formal-section">
        <h2>三、核算边界</h2>
        <p>{content.boundary ?? EMPTY_VALUE}</p>
        {content.study && <>
          <p>{content.study.name} · 第 {content.study.version} 版 · {content.study.boundary}</p>
          <p>生产分摊 {formatNumber(content.productionKg, 6)} kgCO₂e · 纳入合计 {formatNumber(content.studyTotal, 6)} kgCO₂e</p>
        </>}
      </section>

      <section className="formal-section">
        <h2>四、数据质量说明</h2>
        <p>{content.dataQualityNote ?? EMPTY_VALUE}</p>
      </section>

      <div className="formal-foot">
        <span>碳速算 · 报告编号 {report.report_no}</span>
        <span>生成时间 {formatDateTime(content.generatedAt)}</span>
      </div>
    </article>
  )
}
