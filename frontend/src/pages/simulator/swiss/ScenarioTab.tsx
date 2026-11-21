import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { EChartsOption } from 'echarts'
import { calculationsApi, simulatorApi } from '../../../api'
import type { CalculationRunSummary, ScenarioFinance, ScenarioPreviewData, ScenarioRates, ScenarioRecord } from '../../../api/types'
import BaseChart from '../../../components/charts/BaseChart'
import { SwissButton, SwissEmpty, SwissSection, SwissTable } from '../../../components/swiss'
import { formatAmount, formatEmission, formatNumber, formatPercent } from '../../../utils/format'
import { errorMessage } from '../../products/labels'
import InvestmentOutcome from './InvestmentOutcome'
import './ScenarioTab.css'

const controls: Array<{ key: keyof ScenarioRates; name: string; help: string; aria: string }> = [
  { key: 'electricity_saving_rate', name: '设备节电', help: '降低原用电需求', aria: '拖动调整节电比例' },
  { key: 'electricity_substitution_rate', name: '自发绿电替代', help: '替代节电后剩余的外购电量', aria: '调整绿电替代比例' },
  { key: 'procurement_reduction_rate', name: '采购减量', help: '同比例降低纳入核算的采购金额', aria: '拖动调整采购降幅' },
]

const financeFields: Array<{ key: keyof ScenarioFinance; name: string; min: number; max: number; step: number }> = [
  { key: 'capex', name: '初始投资（元）', min: 0, max: 1e12, step: 1000 },
  { key: 'annual_saving', name: '年节约（元）', min: 0, max: 1e12, step: 1000 },
  { key: 'annual_opex', name: '年运维（元）', min: 0, max: 1e12, step: 1000 },
  { key: 'carbon_price', name: '碳价假设（元/吨）', min: 0, max: 100000, step: 1 },
  { key: 'project_life', name: '项目年限', min: 1, max: 50, step: 1 },
  { key: 'discount_rate', name: '折现率（0–1）', min: 0, max: 1, step: .01 },
]

const startingFinance = { capex: 480000, annual_saving: 155000, annual_opex: 28000, carbon_price: 0, project_life: 8, discount_rate: .08 }

function PreviewChart({ result }: { result: ScenarioPreviewData }) {
  const { historical, forecast } = result.projection
  const option = useMemo<EChartsOption>(() => {
    const last = historical.at(-1)?.kgco2e
    const leading: Array<number | null> = historical.map((point, i) => i === historical.length-1 ? point.kgco2e/1000 : null)
    return {
      color: ['#1756a4','#526578','#008078'],
      grid: { left: 58, right: 20, top: 45, bottom: 35, containLabel: false },
      legend: { top: 0, itemGap: 10, textStyle: { fontSize: 11 } },
      tooltip: { trigger: 'axis', valueFormatter: (value) => value == null ? '—' : `${formatNumber(Number(value),2)} tCO₂e` },
      xAxis: { type: 'category', data:[...historical, ...forecast].map((point) => point.period), axisLabel:{ hideOverlap:true } },
      yAxis: { type: 'value', min:0, name:'tCO₂e', splitLine:{ lineStyle:{ color:'#e8eef5' } } },
      series: [
        { name:'历史快照', type:'line', showSymbol: historical.length <= 2, data:[...historical.map((point) => point.kgco2e/1000), ...forecast.map(() => null)] },
        { name:'基准外推', type:'line', showSymbol:false, data:[...leading, ...forecast.map((point) => point.baseline_kgco2e/1000)], lineStyle:{ type:'dashed' } },
        { name:'情景外推', type:'line', showSymbol:false, data:[...leading, ...forecast.map((point) => point.scenario_kgco2e/1000)], areaStyle:{opacity:.1} },
      ].filter((_, i) => i===0 || (last !== undefined && forecast.length>0)) as EChartsOption['series'],
    }
  }, [historical, forecast])
  if (!historical.length) return <SwissEmpty title="当前基线缺少单月历史" description="选用单月核算快照查看月度轨迹。" />
  return <BaseChart option={option} height={285} ariaLabel="历史排放、基准外推和调整后的情景外推" />
}

const columns = [
  { key:'name', title:'情景' },
  { key:'baseline', title:'基线' },
  { key:'power', title:'外购电力降幅' },
  { key:'purchase', title:'采购降幅' },
  { key:'reduction', title:'预计减排' },
  { key:'roi', title:'累计现金回报率' },
  { key:'action', title:'操作' },
]

export default function ScenarioTab({ companyId, canWrite }: { companyId: number; canWrite: boolean }) {
  const [search] = useSearchParams()
  const [runId, setRunId] = useState(search.get('run') || '')
  const [runs, setRuns] = useState<CalculationRunSummary[]>([])
  const [scenarios, setScenarios] = useState<ScenarioRecord[]>([])
  const [loadError,setLoadError] = useState('')
  const [rates, setRates] = useState<ScenarioRates>({ electricity_saving_rate:.14, electricity_substitution_rate:0, procurement_reduction_rate:.08 })
  const [finance, setFinance] = useState<ScenarioFinance>(startingFinance)
  const [draftName, setDraftName] = useState('设备节电与采购优化')
  const [horizon, setHorizon] = useState(6)
  const [result, setResult] = useState<ScenarioPreviewData | null>(null)
  const [calculating, setCalculating] = useState(false)
  const [previewError,setPreviewError] = useState('')
  const [saving,setSaving] = useState(false)
  const [notice,setNotice] = useState('')

  useEffect(() => {
    let active = true
    void Promise.all([calculationsApi.listRuns({ company_id:companyId, operation:'enterprise' }), simulatorApi.listScenarios(companyId)])
      .then(([runs, saved]) => {
        if (!active) return
        setRuns(runs.filter((run) => run.status==='success'))
        setScenarios(saved)
      }).catch((error) => { if (active) setLoadError(errorMessage(error)) })
    return () => { active = false }
  }, [companyId])

  const baseline = runId || runs[0]?.run_id
  const payload = useMemo(() => baseline ? ({
    company_id:companyId, baseline_run_id:baseline, ...rates, finance, forecast_months:horizon,
  }) : null, [companyId,baseline,rates,finance,horizon])

  useEffect(() => {
    if (!payload) return
    if (financeFields.some(({key,min,max}) => {
      const value=finance[key]
      return value == null || !Number.isFinite(value) || value<min || value>max || (key==='project_life' && !Number.isInteger(value))
    })) {
      setResult(null)
      setPreviewError('请填写允许范围内的投资参数。')
      setCalculating(false)
      return
    }
    const controller = new AbortController()
    setPreviewError('')
    setCalculating(true)
    const timer = window.setTimeout(() => {
      void simulatorApi.previewScenario(payload, controller.signal).then((response) => {
        if (controller.signal.aborted) return
        if (response.success) setResult(response.data)
        else {
          setResult(null)
          setPreviewError(response.warnings?.join('。') || '当前基线无法用于减排预演。')
        }
      }).catch((error) => {
        if (!controller.signal.aborted) {
          setResult(null)
          setPreviewError(errorMessage(error))
        }
      }).finally(() => { if (!controller.signal.aborted) setCalculating(false) })
    }, 320)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [payload,finance])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canWrite || !payload || !draftName.trim() || calculating || saving || previewError) return
    setSaving(true)
    setNotice('')
    try {
      const response = await simulatorApi.runScenario({ ...payload, scenario_name:draftName.trim() })
      if (!response.success) throw new Error(response.warnings?.join('。') || '情景未保存')
      setNotice('情景与投资假设已保存。')
      setScenarios(await simulatorApi.listScenarios(companyId))
    } catch (error) { setNotice(errorMessage(error)) }
    finally { setSaving(false) }
  }

  function loadScenario(row: ScenarioRecord) {
    setRunId(row.baseline_run_id && runs.some((run) => run.run_id===row.baseline_run_id) ? row.baseline_run_id : '')
    setRates(row.assumptions ?? { electricity_saving_rate:row.electricity_saving_rate, electricity_substitution_rate:0, procurement_reduction_rate:row.procurement_reduction_rate })
    if (row.roi) setFinance({
      capex:row.roi.capex, annual_saving:row.roi.annual_saving, annual_opex:row.roi.annual_opex,
      carbon_price:row.roi.carbon_price ?? 0, project_life:row.roi.project_life, discount_rate:row.roi.discount_rate,
    })
    setDraftName(row.scenario_name)
  }

  const roi=result?.roi
  const rows=scenarios.map((row) => ({
    key:row.scenario_id,
    name:row.scenario_name,
    baseline:row.baseline_run_id ? <Link to={`/dashboard?run=${row.baseline_run_id}`}>{row.baseline_run_id}</Link> : '当前记录',
    power:formatPercent(row.electricity_saving_rate),
    purchase:formatPercent(row.procurement_reduction_rate),
    reduction:row.reduction_kgco2e == null ? '—' : `${formatEmission(row.reduction_kgco2e)} kgCO₂e`,
    roi:formatPercent(row.roi?.roi),
    action:<button type="button" className="sim-restore" onClick={() => loadScenario(row)}>载入参数</button>,
  }))

  return (
    <div className="scenario-tab">
      {loadError && <p className="sim-error" role="alert">{loadError}</p>}
      <div className="sim-grid">
        <SwissSection title="情景参数" extra="选择基线后拖动滑块">
          <form className="sim-form" onSubmit={save}>
            <label>核算基线
              <select value={runId} onChange={(event) => {setResult(null);setRunId(event.target.value)}}>
                <option value="">最近一次成功核算</option>
                {runs.map((run) => <option key={run.run_id} value={run.run_id}>{run.run_id} · {formatEmission(run.total_kgco2e)} kgCO₂e</option>)}
              </select>
            </label>
            {controls.map(({key,name,help,aria}) => (
              <div className="sim-measure" key={key}>
                <label htmlFor={key}>{name}<output>{Math.round(rates[key]*100)}%</output></label>
                <input id={key} aria-label={aria} type="range" min={0} max={100} step={1} value={Math.round(rates[key]*100)}
                  onChange={(event) => setRates({...rates,[key]:event.target.valueAsNumber/100})} />
                <small>{help}</small>
              </div>
            ))}
            <details className="sim-finance">
              <summary>投资假设 <span>{formatAmount(finance.capex)} · {finance.project_life} 年</span></summary>
              <p>初始值为可编辑示例。碳价默认为零。</p>
              <div className="sim-finance__fields">
                {financeFields.map(({key,name,min,max,step}) => <label key={key}>{name}
                  <input min={min} max={max} step={step} type="number" value={Number.isNaN(finance[key]) ? '' : finance[key]}
                    onChange={(event) => setFinance({...finance,[key]:event.target.valueAsNumber})} />
                </label>)}
              </div>
            </details>
            {canWrite && <label>情景名称
              <input value={draftName} maxLength={90} onChange={(event) => setDraftName(event.target.value)} required />
            </label>}
            {canWrite && <SwissButton type="submit" loading={saving} disabled={!result || !!previewError || calculating}>保存情景</SwissButton>}
            {notice && <p className="sim-notice" role="status">{notice}</p>}
          </form>
        </SwissSection>
        <div className="sim-outcome">
          <SwissSection title="排放与减排轨迹" extra={
            <label className="sim-horizon">预测范围 <select value={horizon} onChange={(event) => setHorizon(Number(event.target.value))}>
              <option value={6}>6 个月</option><option value={12}>12 个月</option>
              <option value={24}>24 个月</option><option value={36}>36 个月</option>
            </select></label>
          }>
            {previewError && <p className="sim-error" role="alert">{previewError}</p>}
            {result && <div aria-busy={calculating}>
              <div className="sim-comparison">
                <div><span>基线排放</span><b>{formatNumber(result.baseline_total_kgco2e/1000)} tCO₂e</b></div>
                <div><span>情景排放</span><b>{formatNumber(result.scenario_total_kgco2e/1000)} tCO₂e</b></div>
                <dl><dt>预计减排</dt><dd>{formatNumber(result.reduction_kgco2e/1000)} t · {formatPercent(result.reduction_rate)}</dd></dl>
              </div>
              <PreviewChart result={result} />
              <p className="sim-footnote">{result.projection.historical.length} 期历史 · {result.projection.forecast.length} 期外推
                {calculating && ' · 正在重新核算'}。预测假定基线结构延续，保持范围 1 不变。绿电替代量仅调减范围 2 外购电力。</p>
            </div>}
            {!result && !previewError && (calculating ? <p role="status">后端正在预演…</p> :
              <SwissEmpty title="请选择成功的企业核算基线" action={<Link to="/calculations">前往核算</Link>} />)}
          </SwissSection>
          {roi && <SwissSection title="投资回报仪表盘" extra="基于所填投资与费用假设">
            <InvestmentOutcome roi={roi}/>
            <p className="sim-footnote">{roi.carbon_income_included ? '已按 12 期外推减排量计入假设碳收益。' : '本次财务测算不计入碳收益。'}</p>
          </SwissSection>}
        </div>
      </div>
      <SwissSection title="已保存方案" extra={`${scenarios.length} 项`}>
        <SwissTable columns={columns} rows={rows} rowKey={(row) => String(row.key)} empty="尚未保存方案" />
      </SwissSection>
    </div>
  )
}
