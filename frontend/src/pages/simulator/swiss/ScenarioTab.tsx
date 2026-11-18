import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { calculationsApi, simulatorApi } from '../../../api'
import type {
  CalculationRunSummary,
  ScenarioRecord,
  ScenarioResultData,
} from '../../../api/types'
import {
  SwissButton,
  SwissEmpty,
  SwissError,
  SwissField,
  SwissInput,
  SwissSection,
  SwissSelect,
  SwissStat,
  SwissTable,
} from '../../../components/swiss'
import type { SwissTableColumn } from '../../../components/swiss'
import { formatDateTime, formatEmission, formatPercent } from '../../../utils/format'
import { errorMessage, visibleWarnings } from '../../products/labels'
import './ScenarioTab.css'

type ScenarioTabProps = {
  companyId: number
  canWrite: boolean
}

type FieldErrors = Record<string, string>

const SCENARIO_COLUMNS: SwissTableColumn[] = [
  { key: 'scenarioId', title: '情景编号' },
  { key: 'name', title: '名称' },
  { key: 'baseline', title: '基线运行' },
  { key: 'electricity', title: '节电比例', align: 'right' },
  { key: 'procurement', title: '采购降幅', align: 'right' },
  { key: 'baselineTotal', title: '基线排放 (kgCO₂e)', align: 'right' },
  { key: 'scenarioTotal', title: '情景排放 (kgCO₂e)', align: 'right' },
  { key: 'reduction', title: '减排量 (kgCO₂e)', align: 'right' },
  { key: 'reductionRate', title: '减排率', align: 'right' },
]

/** 比例输入提示：输入 0—1，展示对应百分比 */
function rateHint(raw: string): string {
  if (!raw.trim()) return '0—1 的小数，例如 0.10 表示 10%'
  const value = Number(raw)
  if (!Number.isFinite(value)) return '请输入 0—1 之间的小数'
  if (value < 0 || value > 1) return '需在 0—1 之间'
  return `相当于 ${(value * 100).toFixed(1)}%`
}

/** 减排情景：运行情景、查看结果与情景历史。 */
export default function ScenarioTab({ companyId, canWrite }: ScenarioTabProps) {
  const [scenarios, setScenarios] = useState<ScenarioRecord[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [listToken, setListToken] = useState(0)

  const [baselines, setBaselines] = useState<CalculationRunSummary[]>([])
  const [baselinesLoading, setBaselinesLoading] = useState(true)
  const [baselinesError, setBaselinesError] = useState<string | null>(null)

  const [scenarioName, setScenarioName] = useState('节电情景')
  const [electricityRate, setElectricityRate] = useState('0.10')
  const [procurementRate, setProcurementRate] = useState('0')
  const [baselineRunId, setBaselineRunId] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [lastResult, setLastResult] = useState<ScenarioResultData | null>(null)

  const reloadList = useCallback(() => {
    setListToken((token) => token + 1)
  }, [])

  useEffect(() => {
    // 切换企业后，上一次情景结果不再属于当前企业
    setLastResult(null)
    setSubmitError(null)
    setWarnings([])
  }, [companyId])

  useEffect(() => {
    let active = true
    setListLoading(true)
    setListError(null)
    simulatorApi
      .listScenarios(companyId)
      .then((list) => {
        if (active) setScenarios(list)
      })
      .catch((error: unknown) => {
        if (active) {
          setScenarios([])
          setListError(errorMessage(error))
        }
      })
      .finally(() => {
        if (active) setListLoading(false)
      })

    return () => {
      active = false
    }
  }, [companyId, listToken])

  useEffect(() => {
    let active = true
    setBaselinesLoading(true)
    setBaselinesError(null)
    calculationsApi
      .listRuns({ company_id: companyId, operation: 'enterprise' })
      .then((runs) => {
        if (!active) return
        setBaselines(runs.filter((run) => run.status === 'success'))
      })
      .catch((error: unknown) => {
        if (active) {
          setBaselines([])
          setBaselinesError(errorMessage(error))
        }
      })
      .finally(() => {
        if (active) setBaselinesLoading(false)
      })

    return () => {
      active = false
    }
  }, [companyId])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting || !canWrite) return

    const errors: FieldErrors = {}
    if (!scenarioName.trim()) errors.name = '请填写情景名称'
    const electricity = Number(electricityRate)
    if (
      electricityRate.trim() === '' ||
      !Number.isFinite(electricity) ||
      electricity < 0 ||
      electricity > 1
    ) {
      errors.electricity = '节电比例需在 0—1 之间'
    }
    const procurement = Number(procurementRate)
    if (
      procurementRate.trim() === '' ||
      !Number.isFinite(procurement) ||
      procurement < 0 ||
      procurement > 1
    ) {
      errors.procurement = '采购降幅需在 0—1 之间'
    }

    setFieldErrors(errors)
    setSubmitError(null)
    setWarnings([])
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      const response = await simulatorApi.runScenario({
        company_id: companyId,
        scenario_name: scenarioName.trim(),
        electricity_saving_rate: electricity,
        procurement_reduction_rate: procurement,
        ...(baselineRunId ? { baseline_run_id: baselineRunId } : {}),
      })

      if (response.status === 'success') {
        setLastResult(response.data)
        const nextWarnings = visibleWarnings(response.warnings)
        setWarnings(nextWarnings)
        reloadList()
        return
      }

      setLastResult(null)
      const nextWarnings = visibleWarnings(response.warnings)
      setWarnings(nextWarnings)
      setSubmitError(
        nextWarnings.length > 0
          ? '情景运行未完成，请查看下方提示'
          : '情景运行未完成，后端未返回更多信息',
      )
    } catch (error) {
      setLastResult(null)
      setSubmitError(errorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  const scenarioRows = scenarios.map<Record<string, ReactNode>>((scenario) => ({
    id: scenario.scenario_id,
    scenarioId: <span className="sim-code">{scenario.scenario_id}</span>,
    name: scenario.scenario_name,
    baseline: scenario.baseline_run_id ? (
      <span className="sim-code">{scenario.baseline_run_id}</span>
    ) : (
      '当前记录'
    ),
    electricity: formatPercent(scenario.electricity_saving_rate),
    procurement: formatPercent(scenario.procurement_reduction_rate),
    baselineTotal: formatEmission(scenario.baseline_total_kgco2e),
    scenarioTotal: formatEmission(scenario.scenario_total_kgco2e),
    reduction: formatEmission(scenario.reduction_kgco2e),
    reductionRate: (
      <span className="sim-rate">{formatPercent(scenario.reduction_rate)}</span>
    ),
  }))

  return (
    <div className="scenario-tab">
      <div className="sim-grid">
        <SwissSection kicker="运行情景" title="参数" extra={<span>比例 0—1</span>}>
          <form className="sim-form" onSubmit={handleSubmit} noValidate>
            <SwissField
              label="情景名称"
              htmlFor="sim-scenario-name"
              required
              error={fieldErrors.name}
            >
              <SwissInput
                id="sim-scenario-name"
                value={scenarioName}
                disabled={submitting || !canWrite}
                placeholder="例如 节电 10%"
                onChange={(event) => {
                  setScenarioName(event.target.value)
                  if (fieldErrors.name) {
                    setFieldErrors((current) => ({ ...current, name: '' }))
                  }
                }}
              />
            </SwissField>

            <div className="sim-form__pair">
              <SwissField
                label="节电比例"
                htmlFor="sim-electricity"
                required
                error={fieldErrors.electricity}
                hint={rateHint(electricityRate)}
              >
                <SwissInput
                  id="sim-electricity"
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  inputMode="decimal"
                  value={electricityRate}
                  disabled={submitting || !canWrite}
                  onChange={(event) => {
                    setElectricityRate(event.target.value)
                    if (fieldErrors.electricity) {
                      setFieldErrors((current) => ({ ...current, electricity: '' }))
                    }
                  }}
                />
              </SwissField>

              <SwissField
                label="采购降幅"
                htmlFor="sim-procurement"
                required
                error={fieldErrors.procurement}
                hint={rateHint(procurementRate)}
              >
                <SwissInput
                  id="sim-procurement"
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  inputMode="decimal"
                  value={procurementRate}
                  disabled={submitting || !canWrite}
                  onChange={(event) => {
                    setProcurementRate(event.target.value)
                    if (fieldErrors.procurement) {
                      setFieldErrors((current) => ({ ...current, procurement: '' }))
                    }
                  }}
                />
              </SwissField>
            </div>

            <SwissField
              label="基线运行"
              htmlFor="sim-baseline"
              hint="留空使用当前已确认记录；也可指定某次成功的企业核算"
            >
              <SwissSelect
                id="sim-baseline"
                value={baselineRunId}
                disabled={submitting || !canWrite || Boolean(baselinesError)}
                onChange={(event) => setBaselineRunId(event.target.value)}
              >
                <option value="">
                  {baselinesLoading ? '正在加载运行记录…' : '当前已确认记录'}
                </option>
                {baselines.map((run) => (
                  <option key={run.run_id} value={run.run_id}>
                    {run.run_id} · {formatDateTime(run.created_at)} ·{' '}
                    {formatEmission(run.total_kgco2e)} kgCO₂e
                  </option>
                ))}
              </SwissSelect>
            </SwissField>

            {baselinesError ? (
              <div className="sim-inline-error" role="alert">
                基线运行列表加载失败：{baselinesError}
              </div>
            ) : null}

            {!canWrite ? (
              <p className="sim-form__note">审计角色为只读，不能运行新的减排情景。</p>
            ) : null}

            {submitError ? (
              <div className="sim-form__error" role="alert">
                {submitError}
              </div>
            ) : null}

            {warnings.length > 0 ? (
              <ul className="sim-form__warnings">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}

            <div className="sim-form__actions">
              <SwissButton type="submit" loading={submitting} disabled={!canWrite}>
                运行情景
              </SwissButton>
              <span className="sim-form__note">按基线排放与两类减排比例测算</span>
            </div>
          </form>
        </SwissSection>

        <SwissSection
          kicker="本次结果"
          title="情景对比"
          extra={lastResult ? <span>{lastResult.scenario_id}</span> : undefined}
        >
          {lastResult ? (
            <div className="sim-result">
              <div className="sim-stats">
                <SwissStat
                  label="基准排放"
                  value={formatEmission(lastResult.baseline_total_kgco2e)}
                  unit="kgCO₂e"
                />
                <SwissStat
                  label="情景排放"
                  value={formatEmission(lastResult.scenario_total_kgco2e)}
                  unit="kgCO₂e"
                  tone="accent"
                />
                <SwissStat
                  label="减排量"
                  value={formatEmission(lastResult.reduction_kgco2e)}
                  unit="kgCO₂e"
                />
                <SwissStat
                  label="减排率"
                  value={formatPercent(lastResult.reduction_rate)}
                  tone={
                    lastResult.reduction_rate > 0 ? 'accent' : 'default'
                  }
                />
              </div>

              <div className="sim-scope-list">
                {(['scope1', 'scope2', 'scope3'] as const).map((scope) => (
                  <div className="sim-scope-row" key={scope}>
                    <span className="sim-scope-label">{scope.replace('scope', 'Scope ')}</span>
                    <span className="sim-scope-values">
                      <span>{formatEmission(lastResult.baseline_scope_breakdown[scope])}</span>
                      <span className="sim-scope-arrow">→</span>
                      <span className="sim-scope-after">
                        {formatEmission(lastResult.scope_breakdown[scope])}
                      </span>
                      <span className="sim-scope-unit">kgCO₂e</span>
                    </span>
                  </div>
                ))}
              </div>

              {lastResult.changed_records.length > 0 ? (
                <p className="sim-result__note">
                  影响记录 {lastResult.changed_records.length} 条。
                </p>
              ) : null}
            </div>
          ) : (
            <SwissEmpty
              title="尚未运行情景"
              description="设置节电与采购降幅后运行，这里会显示基准与情景排放对比。"
            />
          )}
        </SwissSection>
      </div>

      <SwissSection
        kicker="情景历史"
        title="已保存情景"
        extra={<span>{listLoading ? '加载中' : `共 ${scenarios.length} 个情景`}</span>}
      >
        {listLoading ? (
          <div className="sim-loading" role="status" aria-busy="true">
            正在加载情景…
          </div>
        ) : listError ? (
          <SwissError message={listError} onRetry={reloadList} />
        ) : (
          <SwissTable
            columns={SCENARIO_COLUMNS}
            rows={scenarioRows}
            rowKey={(row) => String(row.id)}
            empty="还没有情景记录"
          />
        )}
      </SwissSection>
    </div>
  )
}
