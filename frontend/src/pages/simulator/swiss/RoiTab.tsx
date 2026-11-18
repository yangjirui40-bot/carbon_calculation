import { useState, type FormEvent, type ReactNode } from 'react'
import { simulatorApi } from '../../../api'
import type { ROIResponse } from '../../../api/types'
import {
  SwissButton,
  SwissEmpty,
  SwissField,
  SwissInput,
  SwissSection,
  SwissStat,
  SwissTable,
} from '../../../components/swiss'
import type { SwissTableColumn } from '../../../components/swiss'
import { formatAmount, formatNumber, formatPercent } from '../../../utils/format'
import { errorMessage } from '../../products/labels'
import './RoiTab.css'

type FieldErrors = Record<string, string>

const CASH_COLUMNS: SwissTableColumn[] = [
  { key: 'year', title: '年份', align: 'right' },
  { key: 'cashFlow', title: '年净现金流', align: 'right' },
  { key: 'cumulative', title: '累计现金流', align: 'right' },
  { key: 'discounted', title: '折现现金流', align: 'right' },
  { key: 'discountedCumulative', title: '折现累计', align: 'right' },
]

function paybackText(value: number | null): string {
  return value === null ? '项目周期内未回收' : `${formatNumber(value, 2)} 年`
}

/** 减排投资财务测算：ROI、NPV、回收期与逐年现金流。 */
export default function RoiTab() {
  const [capex, setCapex] = useState('100000')
  const [annualOpex, setAnnualOpex] = useState('10000')
  const [annualSaving, setAnnualSaving] = useState('50000')
  const [annualReduction, setAnnualReduction] = useState('100000')
  const [carbonPrice, setCarbonPrice] = useState('50')
  const [projectLife, setProjectLife] = useState('10')
  const [discountRate, setDiscountRate] = useState('0.08')

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [result, setResult] = useState<ROIResponse | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    const errors: FieldErrors = {}
    const numericFields: Array<[string, string, boolean]> = [
      ['capex', capex, false],
      ['annual_opex', annualOpex, false],
      ['annual_saving', annualSaving, false],
      ['annual_reduction', annualReduction, false],
      ['carbon_price', carbonPrice, false],
      ['project_life', projectLife, true],
      ['discount_rate', discountRate, false],
    ]
    for (const [key, raw, integerOnly] of numericFields) {
      const value = Number(raw)
      if (raw.trim() === '' || !Number.isFinite(value) || value < 0) {
        errors[key] = '请填写不小于 0 的数值'
        continue
      }
      if (integerOnly && (!Number.isInteger(value) || value <= 0)) {
        errors[key] = '项目年限需为大于 0 的整数'
      }
      if (key === 'discount_rate' && value > 1) {
        errors[key] = '折现率需在 0—1 之间（如 0.08 表示 8%）'
      }
    }

    setFieldErrors(errors)
    setSubmitError(null)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      const response = await simulatorApi.computeRoi({
        capex: Number(capex),
        annual_opex: Number(annualOpex),
        annual_saving: Number(annualSaving),
        annual_reduction_kgco2e: Number(annualReduction),
        carbon_price: Number(carbonPrice),
        project_life: Number(projectLife),
        discount_rate: Number(discountRate),
      })
      setResult(response)
    } catch (error) {
      setResult(null)
      setSubmitError(errorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  const cashRows = (result?.cash_flows ?? []).map<Record<string, ReactNode>>((row) => ({
    id: String(row.year),
    year: row.year,
    cashFlow: formatAmount(row.cash_flow),
    cumulative: formatAmount(row.cumulative),
    discounted: formatAmount(row.discounted),
    discountedCumulative: formatAmount(row.discounted_cumulative),
  }))

  return (
    <div className="roi-tab">
      <div className="roi-grid">
        <SwissSection kicker="投资参数" title="财务测算" extra={<span>金额单位：元</span>}>
          <form className="roi-form" onSubmit={handleSubmit} noValidate>
            <div className="roi-form__pair">
              <SwissField
                label="初始投资"
                htmlFor="roi-capex"
                required
                error={fieldErrors.capex}
              >
                <SwissInput
                  id="roi-capex"
                  type="number"
                  min="0"
                  step="any"
                  value={capex}
                  disabled={submitting}
                  onChange={(event) => {
                    setCapex(event.target.value)
                    if (fieldErrors.capex) {
                      setFieldErrors((current) => ({ ...current, capex: '' }))
                    }
                  }}
                />
              </SwissField>

              <SwissField
                label="年运维成本"
                htmlFor="roi-opex"
                required
                error={fieldErrors.annual_opex}
              >
                <SwissInput
                  id="roi-opex"
                  type="number"
                  min="0"
                  step="any"
                  value={annualOpex}
                  disabled={submitting}
                  onChange={(event) => {
                    setAnnualOpex(event.target.value)
                    if (fieldErrors.annual_opex) {
                      setFieldErrors((current) => ({ ...current, annual_opex: '' }))
                    }
                  }}
                />
              </SwissField>

              <SwissField
                label="年节约成本"
                htmlFor="roi-saving"
                required
                error={fieldErrors.annual_saving}
              >
                <SwissInput
                  id="roi-saving"
                  type="number"
                  min="0"
                  step="any"
                  value={annualSaving}
                  disabled={submitting}
                  onChange={(event) => {
                    setAnnualSaving(event.target.value)
                    if (fieldErrors.annual_saving) {
                      setFieldErrors((current) => ({ ...current, annual_saving: '' }))
                    }
                  }}
                />
              </SwissField>

              <SwissField
                label="年减排量"
                htmlFor="roi-reduction"
                required
                error={fieldErrors.annual_reduction}
                hint="kgCO₂e / 年"
              >
                <SwissInput
                  id="roi-reduction"
                  type="number"
                  min="0"
                  step="any"
                  value={annualReduction}
                  disabled={submitting}
                  onChange={(event) => {
                    setAnnualReduction(event.target.value)
                    if (fieldErrors.annual_reduction) {
                      setFieldErrors((current) => ({ ...current, annual_reduction: '' }))
                    }
                  }}
                />
              </SwissField>

              <SwissField
                label="碳价"
                htmlFor="roi-carbon-price"
                required
                error={fieldErrors.carbon_price}
                hint="元 / 吨 CO₂e"
              >
                <SwissInput
                  id="roi-carbon-price"
                  type="number"
                  min="0"
                  step="any"
                  value={carbonPrice}
                  disabled={submitting}
                  onChange={(event) => {
                    setCarbonPrice(event.target.value)
                    if (fieldErrors.carbon_price) {
                      setFieldErrors((current) => ({ ...current, carbon_price: '' }))
                    }
                  }}
                />
              </SwissField>

              <SwissField
                label="项目年限"
                htmlFor="roi-life"
                required
                error={fieldErrors.project_life}
              >
                <SwissInput
                  id="roi-life"
                  type="number"
                  min="1"
                  step="1"
                  value={projectLife}
                  disabled={submitting}
                  onChange={(event) => {
                    setProjectLife(event.target.value)
                    if (fieldErrors.project_life) {
                      setFieldErrors((current) => ({ ...current, project_life: '' }))
                    }
                  }}
                />
              </SwissField>
            </div>

            <SwissField
              label="折现率"
              htmlFor="roi-discount"
              required
              error={fieldErrors.discount_rate}
              hint="0—1 的小数，例如 0.08 表示 8%"
            >
              <SwissInput
                id="roi-discount"
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={discountRate}
                disabled={submitting}
                onChange={(event) => {
                  setDiscountRate(event.target.value)
                  if (fieldErrors.discount_rate) {
                    setFieldErrors((current) => ({ ...current, discount_rate: '' }))
                  }
                }}
              />
            </SwissField>

            {submitError ? (
              <div className="roi-form__error" role="alert">
                {submitError}
              </div>
            ) : null}

            <div className="roi-form__actions">
              <SwissButton type="submit" loading={submitting}>
                计算 ROI
              </SwissButton>
              <span className="roi-form__note">碳收益 = 年减排量 ÷ 1000 × 碳价</span>
            </div>
          </form>
        </SwissSection>

        <SwissSection
          kicker="测算结果"
          title="投资回报"
          extra={result ? <span>项目周期 {result.project_life} 年</span> : undefined}
        >
          {result ? (
            <div className="roi-result">
              <div className="roi-stats">
                <SwissStat
                  label="ROI"
                  value={result.roi === null ? '—' : formatPercent(result.roi)}
                  tone={result.roi !== null && result.roi > 0 ? 'accent' : 'default'}
                />
                <SwissStat
                  label="NPV"
                  value={formatAmount(result.npv)}
                  tone={result.npv >= 0 ? 'accent' : 'fail'}
                />
                <SwissStat
                  label="静态回收期"
                  value={paybackText(result.payback_period_years)}
                />
                <SwissStat
                  label="动态回收期"
                  value={paybackText(result.discounted_payback_period_years)}
                />
                <SwissStat
                  label="年碳收益"
                  value={formatAmount(result.annual_carbon_revenue)}
                />
                <SwissStat
                  label="年净现金流"
                  value={formatAmount(result.annual_net_cash_flow)}
                />
              </div>
              <p className="roi-result__meta">
                初始投资 {formatAmount(result.capex)} · 年运维 {formatAmount(result.annual_opex)} ·
                折现率 {formatPercent(result.discount_rate)}
              </p>
            </div>
          ) : (
            <SwissEmpty
              title="尚未测算"
              description="填写投资与减排参数后点击“计算 ROI”，这里会显示 NPV、回收期与现金流。"
            />
          )}
        </SwissSection>
      </div>

      {result ? (
        <SwissSection
          kicker="现金流"
          title="逐年现金流"
          extra={<span>折现累计为负表示尚未回本</span>}
        >
          <SwissTable
            columns={CASH_COLUMNS}
            rows={cashRows}
            rowKey={(row) => String(row.id)}
            empty="没有现金流数据"
          />
        </SwissSection>
      ) : null}
    </div>
  )
}
