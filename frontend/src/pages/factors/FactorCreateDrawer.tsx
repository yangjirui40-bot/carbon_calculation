import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { factorsApi } from '../../api'
import type { FactorCreatePayload, FactorRecord } from '../../api/types'
import {
  SwissButton,
  SwissDrawer,
  SwissField,
  SwissInput,
  SwissSelect,
} from '../../components/swiss'
import {
  CATEGORY_LABELS,
  FACTOR_SCOPE_OPTIONS,
  categoryLabel,
  inferScope,
} from './constants'
import { toErrorMessage } from './errors'

type FactorCreateDrawerProps = {
  open: boolean
  onClose: () => void
  onCreated: (factor: FactorRecord) => void
}

type FieldErrors = Record<string, string>

/** 管理员新建因子；scope 随类别自动带出，可手动调整 */
export default function FactorCreateDrawer({
  open,
  onClose,
  onCreated,
}: FactorCreateDrawerProps) {
  const [factorId, setFactorId] = useState('')
  const [category, setCategory] = useState('')
  const [scope, setScope] = useState('scope3')
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState('')
  const [version, setVersion] = useState('')
  const [origin, setOrigin] = useState('')
  const [priceBasis, setPriceBasis] = useState('')
  const [isDemo, setIsDemo] = useState('true')
  const [description, setDescription] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setFactorId('')
    setCategory('')
    setScope('scope3')
    setValue('')
    setUnit('')
    setVersion('')
    setOrigin('')
    setPriceBasis('')
    setIsDemo('true')
    setDescription('')
    setFieldErrors({})
    setSubmitError(null)
    setSubmitting(false)
  }, [open])

  const categoryOptions = useMemo(
    () =>
      Object.keys(CATEGORY_LABELS).sort((a, b) =>
        categoryLabel(a).localeCompare(categoryLabel(b), 'zh-Hans-CN'),
      ),
    [],
  )

  function handleCategoryChange(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value
    setCategory(next)
    if (next) setScope(inferScope(next))
  }

  function validate(): FieldErrors {
    const errors: FieldErrors = {}
    if (!factorId.trim()) errors.factor_id = '请填写因子编号'
    if (!category) errors.category = '请选择类别'
    const numeric = Number(value)
    if (value.trim() === '' || !Number.isFinite(numeric) || numeric < 0) {
      errors.value = '请填写不小于 0 的数值'
    }
    if (!unit.trim()) errors.unit = '请填写单位，如 kgCO2e/kWh'
    if (!version.trim()) errors.version = '请填写版本，如 official-2022'
    return errors
  }

  async function handleSubmit() {
    if (submitting) return
    const errors = validate()
    setFieldErrors(errors)
    setSubmitError(null)
    if (Object.keys(errors).length > 0) return

    const payload: FactorCreatePayload = {
      factor_id: factorId.trim(),
      category,
      scope,
      value: Number(value),
      unit: unit.trim(),
      version: version.trim(),
      is_demo: isDemo === 'true',
    }
    if (origin.trim()) payload.origin = origin.trim()
    if (priceBasis.trim()) payload.price_basis = priceBasis.trim()
    if (description.trim()) payload.description = description.trim()

    setSubmitting(true)
    try {
      const created = await factorsApi.createFactor(payload)
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
      title="新建排放因子"
      onClose={onClose}
      width={480}
      footer={
        <>
          <SwissButton variant="ghost" onClick={onClose} disabled={submitting}>
            取消
          </SwissButton>
          <SwissButton type="submit" form="factor-create-form" loading={submitting}>
            保存因子
          </SwissButton>
        </>
      }
    >
      <form
        id="factor-create-form"
        className="factors-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void handleSubmit()
        }}
      >
        {submitError ? (
          <div className="factors-form__error" role="alert">
            {submitError}
          </div>
        ) : null}

        <div className="factors-form__full">
          <SwissField
            label="因子编号"
            htmlFor="factor-create-id"
            required
            error={fieldErrors.factor_id}
          >
            <SwissInput
              id="factor-create-id"
              value={factorId}
              placeholder="如 MEE_ELEC_2022_NAT"
              onChange={(event) => setFactorId(event.target.value)}
            />
          </SwissField>
        </div>

        <SwissField
          label="类别"
          htmlFor="factor-create-category"
          required
          error={fieldErrors.category}
        >
          <SwissSelect
            id="factor-create-category"
            value={category}
            onChange={handleCategoryChange}
          >
            <option value="">请选择类别</option>
            {categoryOptions.map((key) => (
              <option key={key} value={key}>
                {categoryLabel(key)}
              </option>
            ))}
          </SwissSelect>
        </SwissField>

        <SwissField label="Scope" htmlFor="factor-create-scope">
          <SwissSelect
            id="factor-create-scope"
            value={scope}
            onChange={(event) => setScope(event.target.value)}
          >
            {FACTOR_SCOPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SwissSelect>
        </SwissField>

        <SwissField
          label="数值"
          htmlFor="factor-create-value"
          required
          error={fieldErrors.value}
        >
          <SwissInput
            id="factor-create-value"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={value}
            placeholder="如 0.5703"
            onChange={(event) => setValue(event.target.value)}
          />
        </SwissField>

        <SwissField
          label="单位"
          htmlFor="factor-create-unit"
          required
          error={fieldErrors.unit}
        >
          <SwissInput
            id="factor-create-unit"
            value={unit}
            placeholder="如 kgCO2e/kWh"
            onChange={(event) => setUnit(event.target.value)}
          />
        </SwissField>

        <SwissField
          label="版本"
          htmlFor="factor-create-version"
          required
          error={fieldErrors.version}
        >
          <SwissInput
            id="factor-create-version"
            value={version}
            placeholder="如 official-2022"
            onChange={(event) => setVersion(event.target.value)}
          />
        </SwissField>

        <SwissField label="口径" htmlFor="factor-create-caliber">
          <SwissSelect
            id="factor-create-caliber"
            value={isDemo}
            onChange={(event) => setIsDemo(event.target.value)}
          >
            <option value="true">项目因子</option>
            <option value="false">官方因子</option>
          </SwissSelect>
        </SwissField>

        <div className="factors-form__full">
          <SwissField label="来源" htmlFor="factor-create-origin">
            <SwissInput
              id="factor-create-origin"
              value={origin}
              placeholder="如 生态环境部公告（含文号与年份）"
              onChange={(event) => setOrigin(event.target.value)}
            />
          </SwissField>
        </div>

        <div className="factors-form__full">
          <SwissField label="价格基准" htmlFor="factor-create-price-basis">
            <SwissInput
              id="factor-create-price-basis"
              value={priceBasis}
              placeholder="采购类因子填写价格基准，可不填"
              onChange={(event) => setPriceBasis(event.target.value)}
            />
          </SwissField>
        </div>

        <div className="factors-form__full">
          <SwissField label="说明" htmlFor="factor-create-description">
            <SwissInput
              id="factor-create-description"
              value={description}
              placeholder="口径说明，可不填"
              onChange={(event) => setDescription(event.target.value)}
            />
          </SwissField>
        </div>
      </form>
    </SwissDrawer>
  )
}
