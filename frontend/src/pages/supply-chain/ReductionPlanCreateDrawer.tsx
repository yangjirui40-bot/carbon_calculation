import { useEffect, useState } from 'react'
import { supplyChainApi } from '../../api'
import type { SupplierRecord } from '../../api/types'
import {
  SwissButton,
  SwissDrawer,
  SwissField,
  SwissInput,
  SwissSelect,
} from '../../components/swiss'
import { errorText } from './errors'
import './shared.css'

type ReductionPlanCreateDrawerProps = {
  open: boolean
  companyId: number | null
  suppliers: SupplierRecord[]
  existingIds: string[]
  onClose: () => void
  onCreated: () => void
}

/** 新建减排计划：界面用百分比输入，提交时换算为 0—1 的比例 */
export default function ReductionPlanCreateDrawer({
  open,
  companyId,
  suppliers,
  existingIds,
  onClose,
  onCreated,
}: ReductionPlanCreateDrawerProps) {
  const [planId, setPlanId] = useState('')
  const [title, setTitle] = useState('')
  const [targetSupplier, setTargetSupplier] = useState('')
  const [ratePercent, setRatePercent] = useState('5')
  const [deadline, setDeadline] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setPlanId('')
    setTitle('')
    setTargetSupplier('')
    setRatePercent('5')
    setDeadline('')
    setFieldErrors({})
    setSubmitError(null)
    setSubmitting(false)
  }, [open])

  async function handleSubmit() {
    if (submitting) return
    if (companyId === null) {
      setSubmitError('请先选择企业，再新建减排计划。')
      return
    }

    const errors: Record<string, string> = {}
    const trimmedId = planId.trim()
    if (!trimmedId) {
      errors.plan_id = '请填写计划编号'
    } else if (existingIds.includes(trimmedId)) {
      errors.plan_id = '计划编号已存在'
    }
    if (!title.trim()) errors.title = '请填写计划标题'
    const rateValue = Number(ratePercent)
    if (!Number.isFinite(rateValue) || rateValue < 0 || rateValue > 100) {
      errors.rate = '目标减排率需在 0—100% 之间'
    }
    setFieldErrors(errors)
    setSubmitError(null)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      await supplyChainApi.createReductionPlan(companyId, {
        plan_id: trimmedId,
        title: title.trim(),
        target_reduction_rate: rateValue / 100,
        ...(targetSupplier ? { target_supplier_id: targetSupplier } : {}),
        ...(deadline ? { deadline } : {}),
      })
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
      title="新建减排计划"
      onClose={onClose}
      width={520}
      footer={
        <>
          <SwissButton variant="ghost" onClick={onClose} disabled={submitting}>
            取消
          </SwissButton>
          <SwissButton type="submit" form="plan-create-form" loading={submitting}>
            保存计划
          </SwissButton>
        </>
      }
    >
      <form
        id="plan-create-form"
        className="sc-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void handleSubmit()
        }}
      >
        <p className="sc-form__meta">
          新计划状态默认为进行中，进度从 0 开始；目标减排率按百分比填写。
        </p>

        {submitError ? (
          <div className="sc-form__error" role="alert">
            {submitError}
          </div>
        ) : null}

        <SwissField
          label="计划编号"
          htmlFor="plan-create-id"
          required
          error={fieldErrors.plan_id}
          hint="如 plan-w7-test"
        >
          <SwissInput
            id="plan-create-id"
            value={planId}
            onChange={(event) => setPlanId(event.target.value)}
          />
        </SwissField>

        <SwissField
          label="标题"
          htmlFor="plan-create-title"
          required
          error={fieldErrors.title}
        >
          <SwissInput
            id="plan-create-title"
            value={title}
            placeholder="如 一级供应商年度减排 5%"
            onChange={(event) => setTitle(event.target.value)}
          />
        </SwissField>

        <SwissField label="目标供应商" htmlFor="plan-create-supplier" hint="可不选">
          <SwissSelect
            id="plan-create-supplier"
            value={targetSupplier}
            onChange={(event) => setTargetSupplier(event.target.value)}
          >
            <option value="">不指定供应商</option>
            {suppliers.map((supplier) => (
              <option key={supplier.supplier_id} value={supplier.supplier_id}>
                {supplier.name}（{supplier.supplier_id}）
              </option>
            ))}
          </SwissSelect>
        </SwissField>

        <SwissField
          label="目标减排率"
          htmlFor="plan-create-rate"
          error={fieldErrors.rate}
          hint="0—100%，如 5 表示 5%"
        >
          <SwissInput
            id="plan-create-rate"
            type="number"
            min="0"
            max="100"
            step="0.1"
            inputMode="decimal"
            value={ratePercent}
            onChange={(event) => setRatePercent(event.target.value)}
          />
        </SwissField>

        <SwissField label="截止日期" htmlFor="plan-create-deadline" hint="可不填">
          <SwissInput
            id="plan-create-deadline"
            type="date"
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
          />
        </SwissField>
      </form>
    </SwissDrawer>
  )
}
