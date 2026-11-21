import type { ReportDetail } from '../../../api/types'
import {
  EMISSION_UNIT,
  EMPTY_VALUE,
  formatDateTime,
  formatEmissionWithTonnes,
  formatNumber,
} from '../../../utils/format'
import {
  categoryLabel,
  collectFactorRows,
  displayText,
  formatPeriod,
  scopeLabel,
  type IsoReportContent,
} from '../reportContent'
import ReportSheetHead from './ReportSheetHead'
import './ReportSheet.css'

type Iso14064SheetProps = {
  report: ReportDetail
  content: IsoReportContent
}

/** ISO 14064-1 企业温室气体盘查清单：第 1 页汇总，第 2 页明细与因子版本 */
export default function Iso14064Sheet({ report, content }: Iso14064SheetProps) {
  const standard = content.standard ?? 'ISO 14064-1:2018'
  const factorRows = collectFactorRows(content.items)

  return (
    <>
      <article className="formal-sheet" aria-label="ISO 14064 盘查清单汇总">
        <ReportSheetHead
          brand="碳速算 · 温室气体盘查清单"
          meta={`报告编号 ${report.report_no} · ${standard}`}
        />

        <h1 className="formal-title">
          {displayText(report.title) ?? '温室气体盘查清单'}
        </h1>
        <p className="formal-subtitle">
          {content.companyName ?? EMPTY_VALUE} · {formatPeriod(content.reportingPeriod)}
        </p>

        <table className="formal-meta">
          <tbody>
            <tr>
              <td className="label">企业名称</td>
              <td>{content.companyName ?? EMPTY_VALUE}</td>
              <td className="label">企业编号</td>
              <td>{content.companyCode ?? EMPTY_VALUE}</td>
            </tr>
            <tr>
              <td className="label">所属行业</td>
              <td>{content.companyIndustry ?? EMPTY_VALUE}</td>
              <td className="label">核算期间</td>
              <td>{formatPeriod(content.reportingPeriod)}</td>
            </tr>
            <tr>
              <td className="label">核算标准</td>
              <td>{standard}</td>
              <td className="label">生成时间</td>
              <td>{formatDateTime(content.generatedAt)}</td>
            </tr>
            <tr>
              <td className="label">报告编号</td>
              <td>{report.report_no}</td>
              <td className="label">运行编号</td>
              <td>{report.run_id ?? EMPTY_VALUE}</td>
            </tr>
          </tbody>
        </table>

        <section className="formal-section">
          <h2>一、核算边界</h2>
          <p>{content.boundary ?? EMPTY_VALUE}</p>
          {content.boundarySites.map((site) => <p key={site.entity+'-'+site.name}>{site.entity} · {site.name} · {formatNumber(site.share*100,2)}%</p>)}
          {content.internalApproval ? (
            <p>生成时已完成企业内部关账 · {content.internalApproval.period} 第 {content.internalApproval.revision} 版。企业声明边界：{content.internalApproval.boundary}</p>
          ) : <p>该清单未标记为已关账。</p>}
        </section>

        <section className="formal-section">
          <h2>二、排放结果</h2>
          {content.coverage.length > 0 && <details><summary>范围 3 覆盖情况</summary><ol>
            {content.coverage.map((row) => <li key={row.category}>{({
              included:'已纳入', unavailable:'数据缺失', not_applicable:'不适用', excluded:'说明排除',
            } as Record<string,string>)[row.status]} · {row.rationale}</li>)}
          </ol></details>}
          <table className="formal-table">
            <thead>
              <tr>
                <th scope="col">排放范围</th>
                <th scope="col" className="right">排放量（{EMISSION_UNIT}）</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{scopeLabel('scope1')}</td>
                <td className="right num">{formatNumber(content.scope1, 2)}</td>
              </tr>
              <tr>
                <td>{scopeLabel('scope2')}</td>
                <td className="right num">{formatNumber(content.scope2, 2)}</td>
              </tr>
              <tr>
                <td>{scopeLabel('scope3')}</td>
                <td className="right num">{formatNumber(content.scope3, 2)}</td>
              </tr>
              <tr className="formal-table__total">
                <td>合计</td>
                <td className="right num">{formatNumber(content.totalKg, 2)}</td>
              </tr>
            </tbody>
          </table>
          <div className="formal-total-line">
            核算总排放：<b>{formatEmissionWithTonnes(content.totalKg)}</b>
          </div>
        </section>

        <section className="formal-section">
          <h2>三、数据质量说明</h2>
          <p>{content.dataQualityNote ?? EMPTY_VALUE}</p>
        </section>

        <div className="formal-foot">
          <span>碳速算 · 报告编号 {report.report_no}</span>
          <span>生成时间 {formatDateTime(content.generatedAt)}</span>
        </div>
      </article>

      <article className="formal-sheet" aria-label="ISO 14064 排放明细">
        <ReportSheetHead
          brand="碳速算 · 温室气体盘查清单"
          meta={`报告编号 ${report.report_no} · ${standard}`}
        />

        <section className="formal-section formal-section--table">
          <h2>四、排放明细</h2>
          <table className="formal-table">
            <colgroup>
              <col style={{ width: '16%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '20%' }} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">排放范围</th>
                <th scope="col">业务类别</th>
                <th scope="col">活动数据</th>
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
                content.items.map((item, index) => {
                  const activity =
                    item.activity === null
                      ? EMPTY_VALUE
                      : `${formatNumber(item.activity, 2)}${
                          item.basisUnit ? ` ${item.basisUnit}` : ''
                        }`
                  return (
                    <tr key={`${item.recordId ?? 'item'}-${index}`}>
                      <td>{scopeLabel(item.scope)}</td>
                      <td>{categoryLabel(item.category)}</td>
                      <td className="num">{activity}</td>
                      <td className="num">{item.factorId ?? EMPTY_VALUE}</td>
                      <td className="num">{item.factorVersion ?? EMPTY_VALUE}</td>
                      <td className="right num">{formatNumber(item.emissionsKg, 2)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </section>

        <section className="formal-section">
          <h2>五、因子版本</h2>
          <p>
            因子版本：
            {content.factorVersions.length > 0
              ? content.factorVersions.join('、')
              : EMPTY_VALUE}
          </p>
          {factorRows.length > 0 ? (
            <table className="formal-table">
              <thead>
                <tr>
                  <th scope="col">因子编号</th>
                  <th scope="col">版本</th>
                </tr>
              </thead>
              <tbody>
                {factorRows.map((row) => (
                  <tr key={`${row.factorId}-${row.factorVersion}`}>
                    <td className="num">{row.factorId}</td>
                    <td className="num">{row.factorVersion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>

        <div className="formal-foot">
          <span>碳速算 · 报告编号 {report.report_no}</span>
          <span>生成时间 {formatDateTime(content.generatedAt)}</span>
        </div>
      </article>
    </>
  )
}
