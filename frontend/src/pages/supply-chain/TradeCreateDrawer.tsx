import { useEffect, useMemo, useState } from 'react'
import { supplyChainApi } from '../../api'
import type { CompanyDetail } from '../../api/types'
import {
  SwissButton,
  SwissDrawer,
  SwissField,
  SwissInput,
  SwissSelect,
  SwissTextarea,
} from '../../components/swiss'
import { currentYear } from './constants'
import { errorText } from './errors'
import './shared.css'

type TradeCreateDrawerProps = {
  open: boolean
  companyId: number | null
  sellerName: string
  companies: CompanyDetail[]
  onClose: () => void
  onCreated: () => void
}

/** 发起配额交易：卖方固定为当前企业，买方从企业列表选择并排除自己 */
export default function TradeCreateDrawer({
  open,
  companyId,
  sellerName,
  companies,
  onClose,
  onCreated,
}: TradeCreateDrawerProps) {
  const [buyerId, setBuyerId] = useState('')
  const [year, setYear] = useState(String(currentYear()))
  const [amount, setAmount] = useState('')
  const [price, setPrice] = useState('')
  const [note, setNote] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const buyerOptions = useMemo(
    () => companies.filter((company) => company.id !== companyId),
    [companies, companyId],
  )

  useEffect(() => {
    if (!open) return
    setBuyerId('')
    setYear(String(currentYear()))
    setAmount('')
    setPrice('')
    setNote('')
    setFieldErrors({})
    setSubmitError(null)
    setSubmitting(false)
  }, [open])

  async function handleSubmit() {
    if (submitting) return
    if (companyId === null) {
      setSubmitError('请先选择企业，再发起交易。')
      return
    }
    if (buyerOptions.length === 0) {
      setSubmitError('当前只有一家企业，无法发起跨企业交易。')
      return
    }

    const errors: Record<string, string> = {}
    if (!buyerId) errors.buyer = '请选择买方企业'
    const yearValue = Number(year)
    if (!Number.isInteger(yearValue) || yearValue < 2000 || yearValue > 2100) {
      errors.year = '请填写 2000—2100 之间的年份'
    }
    const amountValue = Number(amount)
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      errors.amount = '数量需为大于 0 的数字'
    }
    const priceValue = Number(price)
    if (!Number.isFinite(priceValue) || priceValue < 0) {
      errors.price = '单价需为不小于 0 的数字'
    }
    setFieldErrors(errors)
    setSubmitError(null)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      await supplyChainApi.createTrade({
        seller_company_id: companyId,
        buyer_company_id: Number(buyerId),
        year: yearValue,
        amount: amountValue,
        price: priceValue,
        ...(note.trim() ? { note: note.trim() } : {}),
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
      title="发起配额交易"
      onClose={onClose}
      width={520}
      footer={
        <>
          <SwissButton variant="ghost" onClick={onClose} disabled={submitting}>
            取消
          </SwissButton>
          <SwissButton
            type="submit"
            form="trade-create-form"
            loading={submitting}
            disabled={buyerOptions.length === 0}
          >
            发起交易
          </SwissButton>
        </>
      }
    >
      <form
        id="trade-create-form"
        className="sc-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void handleSubmit()
        }}
      >
        <p className="sc-form__readonly">卖方企业：{sellerName}</p>

        {buyerOptions.length === 0 ? (
          <div className="sc-notice" role="status">
            当前只有一家企业，无法发起跨企业交易。交易需要至少两家企业。
          </div>
        ) : null}

        {submitError ? (
          <div className="sc-form__error" role="alert">
            {submitError}
          </div>
        ) : null}

        <div className="sc-form__full">
          <SwissField
            label="买方企业"
            htmlFor="trade-create-buyer"
            required
            error={fieldErrors.buyer}
          >
            <SwissSelect
              id="trade-create-buyer"
              value={buyerId}
              disabled={buyerOptions.length === 0}
              onChange={(event) => setBuyerId(event.target.value)}
            >
              <option value="">
                {buyerOptions.length === 0 ? '没有可选买方企业' : '请选择买方企业'}
              </option>
              {buyerOptions.map((company) => (
                <option key={company.id} value={String(company.id)}>
                  {company.name}（{company.code}）
                </option>
              ))}
            </SwissSelect>
          </SwissField>
        </div>

        <SwissField label="年份" htmlFor="trade-create-year" required error={fieldErrors.year}>
          <SwissInput
            id="trade-create-year"
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
          label="数量"
          htmlFor="trade-create-amount"
          required
          error={fieldErrors.amount}
          hint="kgCO₂e"
        >
          <SwissInput
            id="trade-create-amount"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={amount}
            placeholder="如 500"
            onChange={(event) => setAmount(event.target.value)}
          />
        </SwissField>

        <SwissField
          label="单价"
          htmlFor="trade-create-price"
          required
          error={fieldErrors.price}
          hint="元/kgCO₂e"
        >
          <SwissInput
            id="trade-create-price"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={price}
            placeholder="如 60"
            onChange={(event) => setPrice(event.target.value)}
          />
        </SwissField>

        <div className="sc-form__full">
          <SwissField label="备注" htmlFor="trade-create-note">
            <SwissTextarea
              id="trade-create-note"
              rows={3}
              value={note}
              placeholder="可不填"
              onChange={(event) => setNote(event.target.value)}
            />
          </SwissField>
        </div>
      </form>
    </SwissDrawer>
  )
}
