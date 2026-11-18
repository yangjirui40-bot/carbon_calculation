import { useState, type FormEvent } from 'react'
import { calculationsApi } from '../../../api'
import { SwissButton, SwissField, SwissInput, SwissSelect } from '../../../components/swiss'
import { errorMessage, visibleWarnings } from '../labels'
import './EnterpriseRunForm.css'

type EnterpriseRunFormProps = {
  companyId: number | null
  canRun: boolean
  factorSets: string[] | null
  factorSetsError: string | null
  onRetryFactorSets: () => void
  onSuccess: (runId: string) => void
}

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

/** 发起企业 Scope 1/2/3 核算；成功由外层负责跳转结果页。 */
export default function EnterpriseRunForm({
  companyId,
  canRun,
  factorSets,
  factorSetsError,
  onRetryFactorSets,
  onSuccess,
}: EnterpriseRunFormProps) {
  const [period, setPeriod] = useState('')
  const [factorSet, setFactorSet] = useState('')
  const [periodError, setPeriodError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])

  const disabled = !canRun || submitting

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!companyId) {
      setSubmitError('请先选择企业')
      return
    }
    if (period && !PERIOD_PATTERN.test(period)) {
      setPeriodError('期间格式为 YYYY-MM，例如 2026-10')
      return
    }

    setPeriodError(null)
    setSubmitError(null)
    setWarnings([])
    setSubmitting(true)
    try {
      const response = await calculationsApi.runEnterprise({
        company_id: companyId,
        ...(period ? { period } : {}),
        ...(factorSet ? { factor_set: factorSet } : {}),
      })

      if (response.status === 'success') {
        onSuccess(response.run_id)
        return
      }

      const nextWarnings = visibleWarnings(response.warnings)
      setWarnings(nextWarnings)
      setSubmitError(
        nextWarnings.length > 0
          ? '核算未完成，请查看下方提示'
          : '核算未完成，后端未返回更多信息',
      )
    } catch (error) {
      setSubmitError(errorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="calc-form" onSubmit={handleSubmit} noValidate>
      <SwissField
        label="核算期间"
        htmlFor="calc-period"
        error={periodError ?? undefined}
        hint="YYYY-MM；留空表示全部已确认记录"
      >
        <SwissInput
          id="calc-period"
          type="text"
          inputMode="numeric"
          placeholder="2026-10"
          value={period}
          disabled={disabled}
          onChange={(event) => {
            setPeriod(event.target.value.trim())
            if (periodError) setPeriodError(null)
          }}
        />
      </SwissField>

      <SwissField
        label="因子集"
        htmlFor="calc-factor-set"
        hint={
          factorSetsError
            ? undefined
            : '套用官方因子集会按类别替换因子；未覆盖的类别沿用记录因子'
        }
      >
        <SwissSelect
          id="calc-factor-set"
          value={factorSet}
          disabled={disabled || Boolean(factorSetsError)}
          onChange={(event) => setFactorSet(event.target.value)}
        >
          <option value="">
            {factorSets === null && !factorSetsError
              ? '正在加载因子集…'
              : '记录自带因子（不套用官方因子集）'}
          </option>
          {(factorSets ?? []).map((set) => (
            <option key={set} value={set}>
              {set}
            </option>
          ))}
        </SwissSelect>
      </SwissField>

      {factorSetsError ? (
        <div className="calc-inline-error" role="alert">
          <span>{factorSetsError}</span>
          <SwissButton variant="ghost" onClick={onRetryFactorSets}>
            重试
          </SwissButton>
        </div>
      ) : null}

      {!canRun ? (
        <p className="calc-form__note">审计角色为只读，不能发起新的核算任务。</p>
      ) : null}

      {submitError ? (
        <div className="calc-form__error" role="alert">
          {submitError}
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <ul className="calc-form__warnings">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}

      <div className="calc-form__actions">
        <SwissButton type="submit" loading={submitting} disabled={!canRun || !companyId}>
          发起核算
        </SwissButton>
        {!companyId ? (
          <span className="calc-form__note">请先选择企业</span>
        ) : (
          <span className="calc-form__note">按已确认记录计算 Scope 1/2/3</span>
        )}
      </div>
    </form>
  )
}
