import { ArrowRightOutlined, AuditOutlined, BarChartOutlined, CalculatorOutlined, FileSearchOutlined, UploadOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import type { DashboardSummary, Scope } from '../../api/types'
import { formatEmission, formatPercent } from '../../utils/format'

const scopes: Array<{ key: Scope; label: string }> = [
  { key: 'scope1', label: '范围 1 · 直接排放' },
  { key: 'scope2', label: '范围 2 · 外购能源' },
  { key: 'scope3', label: '范围 3 · 价值链' },
]

export default function OperationsOverview({ summary, documentCount, reviewCount, canWrite }: {
  summary: DashboardSummary
  documentCount: number
  reviewCount: number
  canWrite: boolean
}) {
  const { run_id: run, total_kgco2e: total, scope_breakdown: breakdown } = summary
  const period = summary.period || (summary.periods && summary.periods.length > 1 ? `${summary.periods[0]} 至 ${summary.periods.at(-1)}` : '未指定期间')
  return (
    <>
      <div className="ops-grid">
        <section className="ops-emissions" aria-label="企业排放快照">
          <div className="ops-emissions__top">
            <span><BarChartOutlined /> 企业排放快照</span>
            {run ? <time>{period}</time> : <span>待核算</span>}
          </div>
          <div className="ops-total">{run ? formatEmission(total) : '—'} <small>kgCO₂e</small></div>
          <p>{run ? `${summary.record_count ?? 0} 条已计入记录${summary.uses_demo_factors ? ' · 含演示因子' : ''}` : '完成企业核算后，查看排放和证据。'}</p>
          <div className="ops-bar" aria-hidden="true">
            {scopes.filter(({ key }) => breakdown[key] > 0).map(({ key }) => <span key={key} data-scope={key} style={{ flexGrow: breakdown[key] }} />)}
          </div>
          <div className="ops-scopes">
            {scopes.map(({ key, label }) => (
              <Link to={run ? `/dashboard?run=${encodeURIComponent(run)}&view=detail&scope=${key}` : '/dashboard'} key={key} data-scope={key}>
                <i aria-hidden="true" /> <span>{label}</span><strong>{run ? formatPercent(total ? breakdown[key] / total : 0) : '—'}</strong>
              </Link>
            ))}
          </div>
          <Link className="ops-emissions__link" to="/dashboard">展开排放驾驶舱 <ArrowRightOutlined /></Link>
        </section>

        <section className="ops-tasks" aria-labelledby="carbon-tasks">
          <h2 id="carbon-tasks">当前工作</h2>
          <p>从数据采集进入核算与审计</p>
          <Link to="/documents?status=review">
            <span className="ops-task-icon"><FileSearchOutlined /></span>
            <span><b>核对识别结果</b><small>核对原件与活动数据</small></span>
            {reviewCount > 0 ? <strong className="ops-count">{reviewCount}</strong> : <ArrowRightOutlined />}
          </Link>
          <Link to="/documents">
            <span className="ops-task-icon"><UploadOutlined /></span>
            <span><b>{canWrite ? '采集票据与台账' : '查看单据'}</b><small>{documentCount} 份原始单据</small></span>
            <ArrowRightOutlined />
          </Link>
          <Link to={run ? `/audit/runs/${encodeURIComponent(run)}` : '/calculations'}>
            <span className="ops-task-icon">{run ? <AuditOutlined /> : <CalculatorOutlined />}</span>
            <span><b>{run ? '追溯本次核算' : '开始企业核算'}</b><small>{run ? '公式、因子与原始凭证' : '从已确认的业务记录计算'}</small></span>
            <ArrowRightOutlined />
          </Link>
        </section>
      </div>
      <div className="ops-analytics" aria-label="分析模块">
        <Link to="/dashboard?view=flow">排放桑基图 <ArrowRightOutlined /></Link>
        <Link to="/supply-chain">供应链碳热力图 <ArrowRightOutlined /></Link>
        <Link to="/simulator">减排模拟器与投资仪表盘 <ArrowRightOutlined /></Link>
      </div>
    </>
  )
}
