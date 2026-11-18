import type { CompanyDetail, DashboardSummary } from '../../../api/types'
import LineIcon from '../../../components/common/LineIcon'
import SwissButton from '../../../components/swiss/SwissButton'
import SwissEmpty from '../../../components/swiss/SwissEmpty'
import { formatEmissionWithTonnes } from '../../../utils/format'
import './WorkspaceHero.css'

type WorkspaceHeroProps = {
  company: CompanyDetail
  summary: DashboardSummary
  onUpload: () => void
  onManual: () => void
  onCalculate: () => void
}

/** 工作台主结论区：本期总排放 + 企业身份 + 主次入口 */
export default function WorkspaceHero({
  company,
  summary,
  onUpload,
  onManual,
  onCalculate,
}: WorkspaceHeroProps) {
  const period = summary.period ?? '—'
  const hasSnapshot = summary.total_kgco2e > 0

  return (
    <section className="ws-hero" aria-label="本期总排放与快捷入口">
      <div className="ws-hero__main">
        {hasSnapshot ? (
          <>
            <div className="ws-hero__label">本期总排放 / Total emissions</div>
            <div className="ws-total-wrap">
              <div className="ws-total">{formatEmissionWithTonnes(summary.total_kgco2e)}</div>
              <span className="ws-total__rule" aria-hidden="true" />
            </div>
            <p className="ws-hero__period">报告期 {period} · 按已确认业务记录汇总</p>
          </>
        ) : (
          <SwissEmpty
            title="本期还没有核算结果"
            description="上传票据或录入业务记录，完成一次核算后，这里会显示总排放与 Scope 拆分。"
            action={
              <div className="ws-empty-actions">
                <SwissButton onClick={onCalculate}>去核算</SwissButton>
                <SwissButton variant="ghost" onClick={onUpload}>
                  去上传
                </SwissButton>
              </div>
            }
          />
        )}

        {hasSnapshot ? (
          <div className="ws-ctas">
            <SwissButton onClick={onUpload}>
              上传票据
              <LineIcon name="upload" size={14} />
            </SwissButton>
            <SwissButton variant="ghost" onClick={onManual}>
              手工录入
              <LineIcon name="plus" size={12} />
            </SwissButton>
          </div>
        ) : null}
      </div>

      <aside className="ws-hero__side">
        <div className="ws-identity">
          <div className="ws-company">{company.name}</div>
          <div className="ws-industry">{company.industry}</div>
        </div>

        <dl className="ws-meta">
          <div className="ws-meta__row">
            <dt>报告期</dt>
            <dd>{period}</dd>
          </div>
          <div className="ws-meta__row">
            <dt>企业编号</dt>
            <dd className="ws-meta__mono">{company.code}</dd>
          </div>
          <div className="ws-meta__row">
            <dt>地区</dt>
            <dd>{company.region ?? '—'}</dd>
          </div>
          <div className="ws-meta__row">
            <dt>规模</dt>
            <dd>{company.scale ?? '—'}</dd>
          </div>
        </dl>
      </aside>
    </section>
  )
}
