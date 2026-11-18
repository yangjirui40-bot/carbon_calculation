import { useEffect, useState } from 'react'
import { supplyChainApi } from '../../api'
import type { RiskLevel, SupplierCreatePayload, SupplierRecord } from '../../api/types'
import {
  SwissButton,
  SwissDrawer,
  SwissField,
  SwissInput,
  SwissSelect,
} from '../../components/swiss'
import { RISK_OPTIONS } from './constants'
import { errorText } from './errors'
import './shared.css'

type SupplierCreateDrawerProps = {
  open: boolean
  companyId: number | null
  existingIds: string[]
  onClose: () => void
  onCreated: (supplier: SupplierRecord) => void
}

function isNonNegative(raw: string): boolean {
  if (raw.trim() === '') return false
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0
}

/** 新建供应商；后端无更新/删除接口，抽屉只承担新增 */
export default function SupplierCreateDrawer({
  open,
  companyId,
  existingIds,
  onClose,
  onCreated,
}: SupplierCreateDrawerProps) {
  const [supplierId, setSupplierId] = useState('')
  const [name, setName] = useState('')
  const [industry, setIndustry] = useState('')
  const [region, setRegion] = useState('')
  const [tier, setTier] = useState('1')
  const [carbonIntensity, setCarbonIntensity] = useState('')
  const [annualEmissions, setAnnualEmissions] = useState('')
  const [riskLevel, setRiskLevel] = useState<RiskLevel>('green')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setSupplierId('')
    setName('')
    setIndustry('')
    setRegion('')
    setTier('1')
    setCarbonIntensity('')
    setAnnualEmissions('')
    setRiskLevel('green')
    setFieldErrors({})
    setSubmitError(null)
    setSubmitting(false)
  }, [open])

  async function handleSubmit() {
    if (submitting) return
    if (companyId === null) {
      setSubmitError('请先选择企业，再新建供应商。')
      return
    }

    const errors: Record<string, string> = {}
    const trimmedId = supplierId.trim()
    if (!trimmedId) {
      errors.supplier_id = '请填写供应商编号'
    } else if (existingIds.includes(trimmedId)) {
      errors.supplier_id = '供应商编号已存在'
    }
    if (!name.trim()) errors.name = '请填写供应商名称'
    const tierValue = Number(tier)
    if (!Number.isInteger(tierValue) || tierValue < 1) {
      errors.tier = '层级需为不小于 1 的整数'
    }
    if (carbonIntensity.trim() !== '' && !isNonNegative(carbonIntensity)) {
      errors.carbon_intensity = '碳强度需为不小于 0 的数字'
    }
    if (annualEmissions.trim() !== '' && !isNonNegative(annualEmissions)) {
      errors.annual_emissions = '年排放需为不小于 0 的数字'
    }

    setFieldErrors(errors)
    setSubmitError(null)
    if (Object.keys(errors).length > 0) return

    const payload: SupplierCreatePayload = {
      supplier_id: trimmedId,
      name: name.trim(),
      tier: tierValue,
      risk_level: riskLevel,
      company_id: companyId,
    }
    if (industry.trim()) payload.industry = industry.trim()
    if (region.trim()) payload.region = region.trim()
    if (carbonIntensity.trim() !== '') payload.carbon_intensity = Number(carbonIntensity)
    if (annualEmissions.trim() !== '') payload.annual_emissions = Number(annualEmissions)

    setSubmitting(true)
    try {
      const created = await supplyChainApi.createSupplier(payload)
      onCreated(created)
    } catch (error) {
      setSubmitError(errorText(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SwissDrawer
      open={open}
      title="新建供应商"
      onClose={onClose}
      width={520}
      footer={
        <>
          <SwissButton variant="ghost" onClick={onClose} disabled={submitting}>
            取消
          </SwissButton>
          <SwissButton type="submit" form="supplier-create-form" loading={submitting}>
            保存供应商
          </SwissButton>
        </>
      }
    >
      <form
        id="supplier-create-form"
        className="sc-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void handleSubmit()
        }}
      >
        <p className="sc-form__meta">
          供应商编号在企业内唯一；碳强度单位为 kgCO₂e/元，年排放单位为 kgCO₂e。
        </p>

        {submitError ? (
          <div className="sc-form__error" role="alert">
            {submitError}
          </div>
        ) : null}

        <SwissField
          label="供应商编号"
          htmlFor="supplier-create-id"
          required
          error={fieldErrors.supplier_id}
          hint="如 sup-w7-test"
        >
          <SwissInput
            id="supplier-create-id"
            value={supplierId}
            onChange={(event) => setSupplierId(event.target.value)}
          />
        </SwissField>

        <SwissField
          label="名称"
          htmlFor="supplier-create-name"
          required
          error={fieldErrors.name}
        >
          <SwissInput
            id="supplier-create-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </SwissField>

        <SwissField label="行业" htmlFor="supplier-create-industry">
          <SwissInput
            id="supplier-create-industry"
            value={industry}
            placeholder="可不填"
            onChange={(event) => setIndustry(event.target.value)}
          />
        </SwissField>

        <SwissField label="地区" htmlFor="supplier-create-region">
          <SwissInput
            id="supplier-create-region"
            value={region}
            placeholder="可不填"
            onChange={(event) => setRegion(event.target.value)}
          />
        </SwissField>

        <SwissField
          label="层级"
          htmlFor="supplier-create-tier"
          required
          error={fieldErrors.tier}
          hint="1 / 2 / 3 级供应商"
        >
          <SwissInput
            id="supplier-create-tier"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={tier}
            onChange={(event) => setTier(event.target.value)}
          />
        </SwissField>

        <SwissField label="风险等级" htmlFor="supplier-create-risk">
          <SwissSelect
            id="supplier-create-risk"
            value={riskLevel}
            onChange={(event) => setRiskLevel(event.target.value as RiskLevel)}
          >
            {RISK_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SwissSelect>
        </SwissField>

        <SwissField
          label="碳强度"
          htmlFor="supplier-create-intensity"
          error={fieldErrors.carbon_intensity}
          hint="选填，kgCO₂e/元"
        >
          <SwissInput
            id="supplier-create-intensity"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={carbonIntensity}
            placeholder="如 0.42"
            onChange={(event) => setCarbonIntensity(event.target.value)}
          />
        </SwissField>

        <SwissField
          label="年排放"
          htmlFor="supplier-create-emissions"
          error={fieldErrors.annual_emissions}
          hint="选填，kgCO₂e"
        >
          <SwissInput
            id="supplier-create-emissions"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={annualEmissions}
            placeholder="如 5200"
            onChange={(event) => setAnnualEmissions(event.target.value)}
          />
        </SwissField>
      </form>
    </SwissDrawer>
  )
}
