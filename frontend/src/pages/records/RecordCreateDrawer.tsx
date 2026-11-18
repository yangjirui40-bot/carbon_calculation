import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { recordsApi } from '../../api'
import type {
  BusinessRecord,
  FactorRecord,
  RecordCreatePayload,
  RecordReviewStatus,
} from '../../api/types'
import {
  SwissButton,
  SwissDrawer,
  SwissField,
  SwissInput,
  SwissSelect,
} from '../../components/swiss'
import { formatNumber } from '../../utils/format'
import {
  CATEGORY_LABELS,
  REVIEW_STATUS_OPTIONS,
  SCOPE_OPTIONS,
  categoryLabel,
  inferScope,
  unitFromFactorUnit,
} from './constants'
import { toErrorMessage } from './errors'

type RecordCreateDrawerProps = {
  open: boolean
  companyId: number | null
  factors: FactorRecord[]
  factorsLoading: boolean
  factorsError: string | null
  onRetryFactors: () => void
  onClose: () => void
  onCreated: (record: BusinessRecord) => void
}

type FieldErrors = Record<string, string>

function isNonNegativeNumber(raw: string): boolean {
  if (raw.trim() === '') return false
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0
}

/** 新增业务记录：Scope 1/2 填活动量+单位，Scope 3 只填金额（不填单位） */
export default function RecordCreateDrawer({
  open,
  companyId,
  factors,
  factorsLoading,
  factorsError,
  onRetryFactors,
  onClose,
  onCreated,
}: RecordCreateDrawerProps) {
  const [recordNo, setRecordNo] = useState('')
  const [period, setPeriod] = useState('')
  const [category, setCategory] = useState('')
  const [scope, setScope] = useState('scope3')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('')
  const [amount, setAmount] = useState('')
  const [factorId, setFactorId] = useState('')
  const [reviewStatus, setReviewStatus] = useState<RecordReviewStatus>('pending')
  const [remark, setRemark] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setRecordNo('')
    setPeriod('')
    setCategory('')
    setScope('scope3')
    setQuantity('')
    setUnit('')
    setAmount('')
    setFactorId('')
    setReviewStatus('pending')
    setRemark('')
    setFieldErrors({})
    setSubmitError(null)
    setSubmitting(false)
  }, [open])

  const categoryOptions = useMemo(() => {
    const values = new Set(factors.map((factor) => factor.category))
    Object.keys(CATEGORY_LABELS).forEach((value) => values.add(value))
    return Array.from(values).sort((a, b) =>
      categoryLabel(a).localeCompare(categoryLabel(b), 'zh-Hans-CN'),
    )
  }, [factors])

  const factorOptions = useMemo(
    () => (category ? factors.filter((factor) => factor.category === category) : factors),
    [factors, category],
  )

  function applyScope(nextScope: string) {
    setScope(nextScope)
    if (nextScope === 'scope3') {
      setQuantity('')
      setUnit('')
    } else {
      setAmount('')
    }
  }

  function handleCategoryChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value
    setCategory(value)
    setFactorId('')
    // 换了类别，原单位可能不再适用；由新因子的单位分母重新带出
    setUnit('')
    if (value) applyScope(inferScope(value))
  }

  function handleScopeChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextScope = event.target.value
    applyScope(nextScope)
    if (nextScope === 'scope3') return
    const factor = factors.find((item) => item.factor_id === factorId)
    const inferredUnit = factor ? unitFromFactorUnit(factor.unit) : ''
    if (inferredUnit) setUnit(inferredUnit)
  }

  function handleFactorChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value
    setFactorId(value)
    const factor = factors.find((item) => item.factor_id === value)
    if (factor && scope !== 'scope3') {
      // 单位以所选因子的分母为准，避免出现“100 L 电力”这类不一致
      const inferredUnit = unitFromFactorUnit(factor.unit)
      if (inferredUnit) setUnit(inferredUnit)
    }
  }

  function validate(): FieldErrors {
    const errors: FieldErrors = {}
    if (!recordNo.trim()) errors.record_no = '请填写记录编号'
    if (!period.trim()) errors.period = '请填写期间，如 2026-10'
    if (!category) errors.category = '请选择类别'
    if (!factorId) errors.factor_id = '请选择排放因子'

    if (scope === 'scope3') {
      if (!isNonNegativeNumber(amount)) errors.amount = '请填写不小于 0 的采购金额'
    } else {
      if (!isNonNegativeNumber(quantity)) errors.quantity = '请填写不小于 0 的活动量'
      if (!unit.trim()) errors.unit = '请填写单位'
    }
    return errors
  }

  async function handleSubmit() {
    if (submitting) return
    if (companyId == null) {
      setSubmitError('请先在筛选栏选择具体企业，再新增记录。')
      return
    }
    const errors = validate()
    setFieldErrors(errors)
    setSubmitError(null)
    if (Object.keys(errors).length > 0) return

    const payload: RecordCreatePayload = {
      record_no: recordNo.trim(),
      company_id: companyId,
      period: period.trim(),
      category,
      scope,
      factor_id: factorId,
      review_status: reviewStatus,
      source: 'manual',
    }
    if (scope === 'scope3') {
      payload.amount = Number(amount)
      payload.currency = 'CNY'
    } else {
      payload.quantity = Number(quantity)
      payload.unit = unit.trim()
    }
    if (remark.trim()) payload.remark = remark.trim()

    setSubmitting(true)
    try {
      const created = await recordsApi.createRecord(payload)
      onCreated(created)
    } catch (err) {
      setSubmitError(toErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SwissDrawer
      open={open}
      title="新增业务记录"
      onClose={onClose}
      width={520}
      footer={
        <>
          <SwissButton variant="ghost" onClick={onClose} disabled={submitting}>
            取消
          </SwissButton>
          <SwissButton type="submit" form="record-create-form" loading={submitting}>
            保存记录
          </SwissButton>
        </>
      }
    >
      <form
        id="record-create-form"
        className="records-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void handleSubmit()
        }}
      >
        <p className="records-form__meta">
          Scope 1 / 2 填写活动量与单位；Scope 3 填写采购金额，不填写单位。
        </p>

        {submitError ? (
          <div className="records-form__error" role="alert">
            {submitError}
          </div>
        ) : null}

        {factorsError ? (
          <div className="records-form__error" role="alert">
            因子列表加载失败：{factorsError}
            <SwissButton
              variant="ghost"
              className="records-inline-button"
              onClick={onRetryFactors}
            >
              重试
            </SwissButton>
          </div>
        ) : null}

        <SwissField
          label="记录编号"
          htmlFor="record-create-no"
          required
          error={fieldErrors.record_no}
        >
          <SwissInput
            id="record-create-no"
            value={recordNo}
            placeholder="如 r012"
            onChange={(event) => setRecordNo(event.target.value)}
          />
        </SwissField>

        <SwissField
          label="期间"
          htmlFor="record-create-period"
          required
          error={fieldErrors.period}
        >
          <SwissInput
            id="record-create-period"
            value={period}
            placeholder="如 2026-10"
            onChange={(event) => setPeriod(event.target.value)}
          />
        </SwissField>

        <SwissField
          label="类别"
          htmlFor="record-create-category"
          required
          error={fieldErrors.category}
        >
          <SwissSelect
            id="record-create-category"
            value={category}
            onChange={handleCategoryChange}
          >
            <option value="">请选择类别</option>
            {categoryOptions.map((value) => (
              <option key={value} value={value}>
                {categoryLabel(value)}
              </option>
            ))}
          </SwissSelect>
        </SwissField>

        <SwissField label="Scope" htmlFor="record-create-scope" required>
          <SwissSelect id="record-create-scope" value={scope} onChange={handleScopeChange}>
            {SCOPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SwissSelect>
        </SwissField>

        <div className="records-form__full">
          <SwissField
            label="排放因子"
            htmlFor="record-create-factor"
            required
            error={fieldErrors.factor_id}
            hint={
              factorsError
                ? undefined
                : category
                  ? '仅显示所选类别的因子'
                  : '先选择类别可缩小因子范围'
            }
          >
            <SwissSelect
              id="record-create-factor"
              value={factorId}
              onChange={handleFactorChange}
              disabled={factorsLoading || Boolean(factorsError)}
            >
              <option value="">
                {factorsLoading
                  ? '正在加载因子…'
                  : factorOptions.length === 0
                    ? '该类别暂无因子'
                    : '请选择因子'}
              </option>
              {factorOptions.map((factor) => (
                <option key={factor.factor_id} value={factor.factor_id}>
                  {factor.factor_id} · {formatNumber(factor.value, 6)} {factor.unit}（
                  {factor.version}）
                </option>
              ))}
            </SwissSelect>
          </SwissField>
        </div>

        {scope === 'scope3' ? (
          <div className="records-form__full">
            <SwissField
              label="采购金额"
              htmlFor="record-create-amount"
              required
              error={fieldErrors.amount}
              hint="以人民币 CNY 计，单位不填写"
            >
              <SwissInput
                id="record-create-amount"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={amount}
                placeholder="如 10000"
                onChange={(event) => setAmount(event.target.value)}
              />
            </SwissField>
          </div>
        ) : (
          <>
            <SwissField
              label="活动量"
              htmlFor="record-create-quantity"
              required
              error={fieldErrors.quantity}
            >
              <SwissInput
                id="record-create-quantity"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={quantity}
                placeholder="如 1200"
                onChange={(event) => setQuantity(event.target.value)}
              />
            </SwissField>

            <SwissField
              label="单位"
              htmlFor="record-create-unit"
              required
              error={fieldErrors.unit}
            >
              <SwissInput
                id="record-create-unit"
                value={unit}
                placeholder="如 kWh、L"
                onChange={(event) => setUnit(event.target.value)}
              />
            </SwissField>
          </>
        )}

        <SwissField label="复核状态" htmlFor="record-create-review">
          <SwissSelect
            id="record-create-review"
            value={reviewStatus}
            onChange={(event) => setReviewStatus(event.target.value as RecordReviewStatus)}
          >
            {REVIEW_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SwissSelect>
        </SwissField>

        <SwissField label="备注" htmlFor="record-create-remark">
          <SwissInput
            id="record-create-remark"
            value={remark}
            placeholder="可不填"
            onChange={(event) => setRemark(event.target.value)}
          />
        </SwissField>
      </form>
    </SwissDrawer>
  )
}
