import { useEffect, useState } from 'react'
import { supplyChainApi } from '../../api'
import type { QuotaCreatePayload, SupplierRecord } from '../../api/types'
import {
  SwissButton,
  SwissDrawer,
  SwissField,
  SwissInput,
  SwissSelect,
} from '../../components/swiss'
import { currentYear } from './constants'
import { errorText } from './errors'
import './shared.css'

type QuotaCreateDrawerProps = {
  open: boolean
  companyId: number | null
  suppliers: SupplierRecord[]
  onClose: () => void
  onCreated: () => void
}

function isNonNegative(raw: string): boolean {
  if (raw.trim() === '') return false
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0
}

/** 新建配额：supplier_id 可为空，表示企业整体配额 */
export default function QuotaCreateDrawer({
  open,
  companyId,
  suppliers,
  onClose,
  onCreated,
}: QuotaCreateDrawerProps) {
  const [supplierId, setSupplierId] = useState('')
  const [year, setYear] = useState(String(currentYear()))
  const [allocated, setAllocated] = useState('')
  const [used, setUsed] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setSupplierId('')
    setYear(String(currentYear()))
    setAllocated('')
    setUsed('')
    setFieldErrors({})
    setSubmitError(null)
    setSubmitting(false)
  }, [open])

  async function handleSubmit() {
    if (submitting) return
    if (companyId === null) {
      setSubmitError('请先选择企业，再新建配额。')
      return
    }

    const errors: Record<string, string> = {}
    const yearValue = Number(year)
    if (!Number.isInteger(yearValue) || yearValue < 2000 || yearValue > 2100) {
      errors.year = '请填写 2000—2100 之间的年份'
    }
    if (!isNonNegative(allocated)) errors.allocated_quota = '请填写不小于 0 的分配量'
    if (used.trim() !== '' && !isNonNegative(used)) {
      errors.used_quota = '使用量需为不小于 0 的数字'
    }
    setFieldErrors(errors)
    setSubmitError(null)
    if (Object.keys(errors).length > 0) return

    const payload: QuotaCreatePayload = {
      company_id: companyId,
      year: yearValue,
      allocated_quota: Number(allocated),
    }
    if (supplierId) payload.supplier_id = supplierId
    if (used.trim() !== '') payload.used_quota = Number(used)

    setSubmitting(true)
    try {
      await supplyChainApi.createQuota(payload)
      onCreated()
    } catch (error) {
      setSubmitError(errorText(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SwissDrawer
      open={open}
      title="新建配额"
      onClose={onClose}
      width={520}
      footer={
        <>
          <SwissButton variant="ghost" onClick={onClose} disabled={submitting}>
            取消
          </SwissButton>
          <SwissButton type="submit" form="quota-create-form" loading={submitting}>
            保存配额
          </SwissButton>
        </>
      }
    >
      <form
        id="quota-create-form"
        className="sc-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void handleSubmit()
        }}
      >
        <p className="sc-form__meta">
          配额数量单位为 kgCO₂e。不选择供应商时记录为企业整体配额。
        </p>

        {submitError ? (
          <div className="sc-form__error" role="alert">
            {submitError}
          </div>
        ) : null}

        <div className="sc-form__full">
          <SwissField label="供应商" htmlFor="quota-create-supplier" hint="可不选，表示企业整体">
            <SwissSelect
              id="quota-create-supplier"
              value={supplierId}
              onChange={(event) => setSupplierId(event.target.value)}
            >
              <option value="">企业整体配额</option>
              {suppliers.map((supplier) => (
                <option key={supplier.supplier_id} value={supplier.supplier_id}>
                  {supplier.name}（{supplier.supplier_id}）
                </option>
              ))}
            </SwissSelect>
          </SwissField>
        </div>

        <SwissField label="年份" htmlFor="quota-create-year" required error={fieldErrors.year}>
          <SwissInput
            id="quota-create-year"
            type="number"
            min="2000"
            max="2100"
            step="1"
            inputMode="numeric"
            value={year}
            onChange={(event) => setYear(event.target.value)}
          />
        </SwissField>

        <SwissField
          label="分配量"
          htmlFor="quota-create-allocated"
          required
          error={fieldErrors.allocated_quota}
          hint="kgCO₂e"
        >
          <SwissInput
            id="quota-create-allocated"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={allocated}
            placeholder="如 6000"
            onChange={(event) => setAllocated(event.target.value)}
          />
        </SwissField>

        <div className="sc-form__full">
          <SwissField
            label="使用量"
            htmlFor="quota-create-used"
            error={fieldErrors.used_quota}
            hint="选填，默认 0；kgCO₂e"
          >
            <SwissInput
              id="quota-create-used"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={used}
              placeholder="如 5200"
              onChange={(event) => setUsed(event.target.value)}
            />
          </SwissField>
        </div>
      </form>
    </SwissDrawer>
  )
}
