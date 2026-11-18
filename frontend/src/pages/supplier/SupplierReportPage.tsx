import dayjs from 'dayjs'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiRequestError, supplierPortalApi } from '../../api'
import type {
  SupplierSubmissionPayload,
  SupplierSubmissionResult,
} from '../../api/types'
import {
  SwissButton,
  SwissField,
  SwissInput,
  SwissMasthead,
  SwissSection,
  SwissStat,
  SwissTextarea,
} from '../../components/swiss'
import { formatNumber } from '../../utils/format'
import './SupplierReportPage.css'

type FieldErrors = {
  period?: string
  emissions?: string
  intensity?: string
}

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

function validateForm(
  period: string,
  emissions: string,
  intensity: string,
): FieldErrors {
  const errors: FieldErrors = {}

  if (!PERIOD_PATTERN.test(period)) {
    errors.period = '按 YYYY-MM 填写期间，例如 2026-11'
  }

  const emissionsValue = Number(emissions)
  if (!emissions.trim() || !Number.isFinite(emissionsValue) || emissionsValue < 0) {
    errors.emissions = '填写不小于 0 的排放量'
  }

  if (intensity.trim()) {
    const intensityValue = Number(intensity)
    if (!Number.isFinite(intensityValue) || intensityValue < 0) {
      errors.intensity = '排放强度不能小于 0'
    }
  }

  return errors
}

/** 碳数据填报：校验后提交，成功展示回执与提交后剩余配额 */
export default function SupplierReportPage() {
  const [period, setPeriod] = useState(() => dayjs().format('YYYY-MM'))
  const [emissions, setEmissions] = useState('')
  const [intensity, setIntensity] = useState('')
  const [note, setNote] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [result, setResult] = useState<SupplierSubmissionResult | null>(null)

  const clearFieldError = (field: keyof FieldErrors) => {
    setFieldErrors((previous) =>
      previous[field] ? { ...previous, [field]: undefined } : previous,
    )
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return

    const errors = validateForm(period, emissions, intensity)
    setFieldErrors(errors)
    setSubmitError('')
    if (Object.keys(errors).length > 0) return

    const payload: SupplierSubmissionPayload = {
      period,
      reported_emissions: Number(emissions),
    }
    if (intensity.trim()) {
      payload.reported_intensity = Number(intensity)
    }
    if (note.trim()) {
      payload.note = note.trim()
    }

    setSubmitting(true)
    try {
      setResult(await supplierPortalApi.submitReport(payload))
    } catch (error) {
      setSubmitError(
        error instanceof ApiRequestError ? error.message : '提交失败，请稍后重试',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleContinue = () => {
    setResult(null)
    setSubmitError('')
    setFieldErrors({})
    setEmissions('')
    setIntensity('')
    setNote('')
  }

  const remaining = result?.quota_remaining
  const remainingIsNegative = typeof remaining === 'number' && remaining < 0

  return (
    <div className="supplier-report-page">
      <SwissMasthead
        kicker="供应商门户 / Report"
        title="碳数据填报"
        description="按期间提交排放量与排放强度；提交后自动扣减当年配额。"
      />

      {result ? (
        <SwissSection kicker="Receipt" title="上报已提交">
          <div className="report-receipt" role="status">
            <div className="report-receipt__main">
              <div className="report-receipt__kicker">Submission</div>
              <p className="report-receipt__id">编号 #{result.submission_id}</p>
              <p className="report-receipt__meta">
                {result.period} · 上报排放量{' '}
                <span className="num">
                  {formatNumber(result.reported_emissions, 2)}
                </span>{' '}
                kgCO₂e
              </p>
            </div>
            <div className="report-receipt__quota">
              <SwissStat
                label="提交后剩余配额"
                value={
                  typeof remaining === 'number' ? formatNumber(remaining, 2) : '—'
                }
                unit={typeof remaining === 'number' ? 'kgCO₂e' : undefined}
                tone={remainingIsNegative ? 'fail' : undefined}
                hint={
                  remainingIsNegative
                    ? '当年配额已超支'
                    : typeof remaining !== 'number'
                      ? '该年度无配额记录，未扣减配额'
                      : undefined
                }
              />
            </div>
          </div>

          <div className="report-actions">
            <SwissButton variant="ghost" onClick={handleContinue}>
              继续填报
            </SwissButton>
            <Link className="report-link" to="/supplier/submissions">
              查看上报历史 →
            </Link>
          </div>
        </SwissSection>
      ) : (
        <SwissSection kicker="Report" title="填报表单">
          <form className="report-form" onSubmit={handleSubmit} noValidate>
            <div className="report-form__grid">
              <SwissField
                label="期间"
                htmlFor="report-period"
                required
                error={fieldErrors.period}
                hint="格式 YYYY-MM"
              >
                <SwissInput
                  id="report-period"
                  type="month"
                  required
                  aria-invalid={Boolean(fieldErrors.period) || undefined}
                  value={period}
                  onChange={(event) => {
                    setPeriod(event.target.value)
                    clearFieldError('period')
                  }}
                />
              </SwissField>

              <SwissField
                label="上报排放量（kgCO₂e）"
                htmlFor="report-emissions"
                required
                error={fieldErrors.emissions}
              >
                <SwissInput
                  id="report-emissions"
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  placeholder="例如 520.5"
                  required
                  aria-invalid={Boolean(fieldErrors.emissions) || undefined}
                  value={emissions}
                  onChange={(event) => {
                    setEmissions(event.target.value)
                    clearFieldError('emissions')
                  }}
                />
              </SwissField>

              <SwissField
                label="排放强度（kgCO₂e/元）"
                htmlFor="report-intensity"
                error={fieldErrors.intensity}
                hint="选填；留空表示本次不上报强度"
              >
                <SwissInput
                  id="report-intensity"
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  placeholder="例如 0.42"
                  aria-invalid={Boolean(fieldErrors.intensity) || undefined}
                  value={intensity}
                  onChange={(event) => {
                    setIntensity(event.target.value)
                    clearFieldError('intensity')
                  }}
                />
              </SwissField>

              <SwissField
                label="备注"
                htmlFor="report-note"
                hint="选填，最多 512 字"
              >
                <SwissTextarea
                  id="report-note"
                  rows={3}
                  maxLength={512}
                  placeholder="补充说明本期间数据口径"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </SwissField>
            </div>

            {submitError ? (
              <p className="report-error" role="alert">
                {submitError}
              </p>
            ) : null}

            <div className="report-actions">
              <SwissButton type="submit" loading={submitting}>
                提交填报
              </SwissButton>
              <span className="report-actions__note">
                提交后自动扣减当年配额并更新年排放。
              </span>
            </div>
          </form>
        </SwissSection>
      )}
    </div>
  )
}
