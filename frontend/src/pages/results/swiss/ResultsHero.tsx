import type { CalculationRunDetail } from '../../../api/types'
import {
  formatDateTime,
  formatEmission,
  formatEmissionWithTonnes,
  formatNumber,
  formatPercent,
} from '../../../utils/format'
import type { EnterpriseResultView } from '../enterpriseResult'
import { operationLabel, runStatusLabel } from '../text'
import './ResultsHero.css'

type ResultsHeroProps = {
  run: CalculationRunDetail
  result: EnterpriseResultView
}

const SCOPES = [
  { key: 'scope1' as const, label: 'Scope 1 · 直接排放', tone: 's1' },
  { key: 'scope2' as const, label: 'Scope 2 · 购入电力', tone: 's2' },
  { key: 'scope3' as const, label: 'Scope 3 · 采购商品与服务', tone: 's3' },
]

/** 结果页首屏：总排放 + Scope 构成条 + 任务元数据。 */
export default function ResultsHero({ run, result }: ResultsHeroProps) {
  const ratioOf = (value: number) =>
    result.totalKg > 0 ? value / result.totalKg : 0

  const factorVersions =
    result.factorVersions.length > 0
      ? result.factorVersions
      : (run.factor_versions ?? [])

  return (
    <section className="results-hero">
      <div className="results-hero__main">
        <div className="results-total-label">核算总排放 / Total emissions</div>
        <div className="results-total-value">{formatEmissionWithTonnes(result.totalKg)}</div>

        <div className="results-stack" aria-hidden="true">
          {SCOPES.map((item) => (
            <i
              key={item.key}
              className={`results-stack__seg results-stack__seg--${item.tone}`}
              style={{ width: `${ratioOf(result[item.key]) * 100}%` }}
            />
          ))}
        </div>

        <div className="results-legend">
          {SCOPES.map((item) => {
            const value = result[item.key]
            return (
              <div className="results-legend-item" key={item.key}>
                <small className={`results-legend-key results-legend-key--${item.tone}`}>
                  {item.label}
                </small>
                <strong>{formatEmission(value)}</strong>
                <span>kgCO₂e · 占 {formatPercent(ratioOf(value))}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="results-run-meta">
        <div className="results-meta-row">
          <span>运行编号</span>
          <b className="results-mono">{run.run_id}</b>
        </div>
        <div className="results-meta-row">
          <span>操作</span>
          <b>{operationLabel(run.operation)}</b>
        </div>
        <div className="results-meta-row">
          <span>状态</span>
          <b className={run.status === 'success' ? 'results-ok' : 'results-fail'}>
            {runStatusLabel(run.status)}
          </b>
        </div>
        <div className="results-meta-row">
          <span>核算期间</span>
          <b>{result.period ?? '全部已确认记录'}</b>
        </div>
        <div className="results-meta-row">
          <span>因子版本</span>
          <b className="results-mono">
            {factorVersions.length > 0 ? factorVersions.join('、') : '—'}
          </b>
        </div>
        <div className="results-meta-row">
          <span>明细条数</span>
          <b>{formatNumber(result.items.length, 0)}</b>
        </div>
        <div className="results-meta-row">
          <span>生成时间</span>
          <b>{formatDateTime(run.created_at)}</b>
        </div>
      </div>
    </section>
  )
}
