import { App } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { factorsApi, recordsApi } from '../../api'
import { ApiRequestError } from '../../api/client'
import type { BusinessRecord, FactorRecord } from '../../api/types'
import { CATEGORY_LABELS, CATEGORY_META } from '../../config/business'
import { formatNumber, formatScope } from '../../utils/format'
import './ManualEntrySheet.css'

type CategoryKey = keyof typeof CATEGORY_LABELS

const CATEGORY_ORDER: CategoryKey[] = [
  'diesel_combustion',
  'electricity',
  'electronic_components',
  'pcb_materials',
  'packaging_materials',
]

type ManualEntrySheetProps = {
  open: boolean
  companyId: number | null
  onClose: () => void
  onCreated: (record: BusinessRecord) => void
}

type FieldErrors = {
  item_name?: string
  period?: string
  quantity?: string
  amount?: string
  factor?: string
  company?: string
}

function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function generateRecordNo(): string {
  const now = new Date()
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate(),
  ).padStart(2, '0')}`
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `MAN-${stamp}-${rand}`
}

export default function ManualEntrySheet({
  open,
  companyId,
  onClose,
  onCreated,
}: ManualEntrySheetProps) {
  const { message, modal } = App.useApp()
  const [itemName, setItemName] = useState('')
  const [period, setPeriod] = useState(currentMonth())
  const [category, setCategory] = useState<CategoryKey>('electricity')
  const [quantity, setQuantity] = useState('')
  const [amount, setAmount] = useState('')
  const [factorId, setFactorId] = useState('')
  const [factors, setFactors] = useState<FactorRecord[]>([])
  const [factorsLoading, setFactorsLoading] = useState(false)
  const [factorsError, setFactorsError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})

  const meta = CATEGORY_META[category]
  const categoryFactors = factors.filter((factor) => factor.category === category)
  const selectedFactor = categoryFactors.find((factor) => factor.factor_id === factorId) ?? null

  const resetForm = () => {
    setItemName('')
    setPeriod(currentMonth())
    setCategory('electricity')
    setQuantity('')
    setAmount('')
    setFactorId('')
    setErrors({})
  }

  const loadFactors = useCallback(async () => {
    setFactorsLoading(true)
    setFactorsError(null)
    try {
      setFactors(await factorsApi.listFactors())
    } catch (err) {
      setFactorsError(
        err instanceof ApiRequestError ? err.message : '排放因子加载失败',
      )
    } finally {
      setFactorsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) resetForm()
  }, [open])

  useEffect(() => {
    if (open) void loadFactors()
  }, [open, loadFactors])

  /** 类别切换后选用该类别的第一个因子；保留已选的有效因子 */
  useEffect(() => {
    if (!open) return
    const list = factors.filter((factor) => factor.category === category)
    setFactorId((prev) =>
      list.some((factor) => factor.factor_id === prev) ? prev : list[0]?.factor_id ?? '',
    )
  }, [open, category, factors])

  if (!open) return null

  const hasDraft =
    Boolean(itemName.trim()) ||
    Boolean(quantity) ||
    Boolean(amount) ||
    category !== 'electricity' ||
    period !== currentMonth()

  const handleClose = () => {
    if (submitting) return
    if (hasDraft) {
      modal.confirm({
        title: '放弃已填写的内容？',
        content: '关闭后本次填写不会保存。',
        okText: '放弃',
        cancelText: '继续填写',
        rootClassName: 'swiss-confirm',
        centered: true,
        okButtonProps: { danger: true },
        onOk: () => {
          resetForm()
          onClose()
        },
      })
      return
    }
    resetForm()
    onClose()
  }

  const handleSubmit = async () => {
    const nextErrors: FieldErrors = {}
    if (!companyId) nextErrors.company = '请先在页面顶部选择企业'
    if (!itemName.trim()) nextErrors.item_name = '请填写事项名称'
    if (!/^\d{4}-\d{2}$/.test(period)) nextErrors.period = '请选择核算月份'

    const quantityValue = quantity.trim() === '' ? null : Number(quantity)
    const amountValue = amount.trim() === '' ? null : Number(amount)

    if (meta.input === 'quantity') {
      if (quantityValue === null || !Number.isFinite(quantityValue)) {
        nextErrors.quantity = '请填写活动量'
      } else if (quantityValue < 0) {
        nextErrors.quantity = '活动量必须大于等于 0'
      }
    } else if (amountValue === null || !Number.isFinite(amountValue)) {
      nextErrors.amount = '请填写未税采购额'
    } else if (amountValue < 0) {
      nextErrors.amount = '金额必须大于等于 0'
    }

    if (!factorId) nextErrors.factor = '该类别没有可用因子'

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0 || !companyId) return

    setSubmitting(true)
    try {
      const record = await recordsApi.createRecord({
        record_no: generateRecordNo(),
        company_id: companyId,
        period,
        category,
        scope: meta.scope,
        currency: 'CNY',
        factor_id: factorId,
        review_status: 'confirmed',
        source: 'manual',
        remark: itemName.trim(),
        ...(meta.input === 'quantity'
          ? { quantity: quantityValue ?? undefined, unit: meta.unit }
          : { amount: amountValue ?? undefined }),
      })
      onCreated(record)
      message.success('已写入业务记录')
      resetForm()
      onClose()
    } catch (err) {
      message.error(
        err instanceof ApiRequestError ? err.message : '保存失败，请稍后重试',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="manual-sheet-layer">
      <div className="manual-sheet-scrim" onClick={handleClose} aria-hidden="true" />
      <div
        className="manual-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-sheet-title"
      >
        <header className="manual-sheet-head">
          <div>
            <div className="manual-sheet-kicker">Manual entry / 01</div>
            <h1 id="manual-sheet-title">手工录入业务数据</h1>
          </div>
          <button type="button" className="manual-sheet-close" onClick={handleClose} aria-label="关闭">
            ×
          </button>
        </header>

        <div className="manual-sheet-body">
          <div className="manual-sheet-notice">
            提交后立即写入业务记录，参与后续核算；活动数据请与原始凭证保持一致。
          </div>

          <div className="manual-sheet-grid">
            <div>
              <div className="manual-field">
                <label className="manual-field-label" htmlFor="manual-item-name">
                  <b>01</b>事项名称
                </label>
                <input
                  id="manual-item-name"
                  className="manual-input"
                  value={itemName}
                  onChange={(event) => setItemName(event.target.value)}
                  placeholder="保留原始业务名称"
                />
                {errors.item_name ? <p className="manual-field-error">{errors.item_name}</p> : null}
              </div>

              <div className="manual-field">
                <label className="manual-field-label" htmlFor="manual-period">
                  <b>02</b>核算期（月）
                </label>
                <input
                  id="manual-period"
                  type="month"
                  className="manual-input"
                  value={period}
                  onChange={(event) => setPeriod(event.target.value)}
                />
                {errors.period ? <p className="manual-field-error">{errors.period}</p> : null}
              </div>

              <div className="manual-field">
                <div className="manual-field-label"><b>03</b>业务类别</div>
                <div className="manual-chips">
                  {CATEGORY_ORDER.map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={key === category ? 'manual-chip is-active' : 'manual-chip'}
                      onClick={() => {
                        setCategory(key)
                        setErrors({})
                      }}
                    >
                      {CATEGORY_LABELS[key]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="manual-field">
                <label className="manual-field-label" htmlFor="manual-value">
                  <b>04</b>
                  {meta.input === 'quantity' ? `活动量（${meta.unit}）` : '未税采购额（CNY）'}
                </label>
                <input
                  id="manual-value"
                  type="number"
                  min={0}
                  step="0.01"
                  className="manual-input"
                  value={meta.input === 'quantity' ? quantity : amount}
                  onChange={(event) =>
                    meta.input === 'quantity'
                      ? setQuantity(event.target.value)
                      : setAmount(event.target.value)
                  }
                  placeholder="0.00"
                />
                {errors.quantity ? <p className="manual-field-error">{errors.quantity}</p> : null}
                {errors.amount ? <p className="manual-field-error">{errors.amount}</p> : null}
              </div>

              <div className="manual-field">
                <label className="manual-field-label" htmlFor="manual-factor">
                  <b>05</b>排放因子
                </label>
                {categoryFactors.length > 0 ? (
                  <select
                    id="manual-factor"
                    className="manual-input"
                    value={factorId}
                    onChange={(event) => setFactorId(event.target.value)}
                  >
                    {categoryFactors.map((factor) => (
                      <option key={factor.factor_id} value={factor.factor_id}>
                        {factor.factor_id} · {factor.value} {factor.unit} · {factor.version}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="manual-factor-empty">
                    {factorsLoading ? '正在加载因子…' : '该类别暂无可选因子'}
                    {factorsError ? (
                      <button type="button" className="manual-factor-retry" onClick={loadFactors}>
                        重试
                      </button>
                    ) : null}
                  </div>
                )}
                {errors.factor ? <p className="manual-field-error">{errors.factor}</p> : null}
                {errors.company ? <p className="manual-field-error">{errors.company}</p> : null}
              </div>
            </div>

            <aside>
              <div className="manual-side-note">
                <small>排放范围</small>
                <b>{formatScope(meta.scope)}</b>
              </div>
              <div className="manual-side-note">
                <small>因子</small>
                <b>{selectedFactor ? selectedFactor.factor_id : '—'}</b>
              </div>
              <div className="manual-side-note">
                <small>因子值</small>
                <b>
                  {selectedFactor
                    ? `${formatNumber(selectedFactor.value, 4)} ${selectedFactor.unit}`
                    : '—'}
                </b>
              </div>
              <div className="manual-side-note">
                <small>单位</small>
                <b>{meta.unit}</b>
              </div>
              <p className="manual-sheet-note">
                燃料按实际耗用量填写，不能用采购金额代替；购电只计入 Scope 2，不再作为普通采购。
              </p>
            </aside>
          </div>
        </div>

        <footer className="manual-sheet-foot">
          <button type="button" className="manual-btn manual-btn-ghost" onClick={handleClose}>
            取消
          </button>
          <button
            type="button"
            className="manual-btn manual-btn-primary"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? '保存中…' : '保存并入库'}
          </button>
        </footer>
      </div>
    </div>
  )
}
