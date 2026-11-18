import type { FactorRecord } from '../../../api/types'
import { SwissField, SwissInput, SwissSelect } from '../../../components/swiss'
import { formatNumber } from '../../../utils/format'
import './ReviewAccountingPanel.css'

type Option = { value: string; label: string }

const SCOPE_OPTIONS: Option[] = [
  { value: 'scope1', label: 'Scope 1 · 直接排放' },
  { value: 'scope2', label: 'Scope 2 · 外购能源' },
  { value: 'scope3', label: 'Scope 3 · 价值链' },
]

type ReviewAccountingPanelProps = {
  period: string
  onPeriodChange: (value: string) => void
  category: string
  categoryOptions: Option[]
  onCategoryChange: (value: string) => void
  scope: string
  onScopeChange: (value: string) => void
  quantity: string
  onQuantityChange: (value: string) => void
  unit: string
  onUnitChange: (value: string) => void
  amount: string
  onAmountChange: (value: string) => void
  factorId: string
  factorOptions: Option[]
  onFactorChange: (value: string) => void
  selectedFactor: FactorRecord | null
  factorsLoading: boolean
  factorsError: string | null
  onReloadFactors: () => void
  note: string
  onNoteChange: (value: string) => void
}

/** 入账信息：record_hint 的可编辑版本，确认后随复核一起提交 */
export default function ReviewAccountingPanel({
  period,
  onPeriodChange,
  category,
  categoryOptions,
  onCategoryChange,
  scope,
  onScopeChange,
  quantity,
  onQuantityChange,
  unit,
  onUnitChange,
  amount,
  onAmountChange,
  factorId,
  factorOptions,
  onFactorChange,
  selectedFactor,
  factorsLoading,
  factorsError,
  onReloadFactors,
  note,
  onNoteChange,
}: ReviewAccountingPanelProps) {
  return (
    <section className="review-accounting">
      <div className="review-fields-head">
        <h2>入账信息</h2>
        <span>确认后生成业务记录</span>
      </div>

      <div className="review-accounting-grid">
        <SwissField label="核算期" htmlFor="review-period" required hint="YYYY-MM">
          <SwissInput
            id="review-period"
            value={period}
            placeholder="2026-10"
            onChange={(event) => onPeriodChange(event.target.value)}
          />
        </SwissField>

        <SwissField label="业务类别" htmlFor="review-category" required>
          <SwissSelect
            id="review-category"
            value={category}
            onChange={(event) => onCategoryChange(event.target.value)}
          >
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SwissSelect>
        </SwissField>

        <SwissField label="排放范围" htmlFor="review-scope" required>
          <SwissSelect
            id="review-scope"
            value={scope}
            onChange={(event) => onScopeChange(event.target.value)}
          >
            {SCOPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SwissSelect>
        </SwissField>

        <SwissField
          label="排放因子"
          htmlFor="review-factor"
          required
          hint={
            selectedFactor
              ? `${formatNumber(selectedFactor.value, 4)} ${selectedFactor.unit} · ${selectedFactor.version}${
                  selectedFactor.is_demo ? ' · 内置因子' : ''
                }`
              : undefined
          }
          error={
            !factorsLoading && factorOptions.length === 0
              ? '该类别没有可用因子，请先在因子库补充'
              : undefined
          }
        >
          <SwissSelect
            id="review-factor"
            value={factorId}
            disabled={factorsLoading || factorOptions.length === 0}
            onChange={(event) => onFactorChange(event.target.value)}
          >
            {factorsLoading ? <option value="">加载中…</option> : null}
            {factorOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SwissSelect>
        </SwissField>

        <SwissField label="活动量" htmlFor="review-quantity" hint={unit ? `单位：${unit}` : undefined}>
          <SwissInput
            id="review-quantity"
            type="number"
            min={0}
            step="any"
            value={quantity}
            placeholder="0.00"
            onChange={(event) => onQuantityChange(event.target.value)}
          />
        </SwissField>

        <SwissField label="采购金额" htmlFor="review-amount" hint="未税金额 · CNY">
          <SwissInput
            id="review-amount"
            type="number"
            min={0}
            step="0.01"
            value={amount}
            placeholder="0.00"
            onChange={(event) => onAmountChange(event.target.value)}
          />
        </SwissField>

        <SwissField label="单位" htmlFor="review-unit">
          <SwissInput
            id="review-unit"
            value={unit}
            placeholder="kWh / L / CNY"
            onChange={(event) => onUnitChange(event.target.value)}
          />
        </SwissField>

        <SwissField label="复核备注" htmlFor="review-note">
          <SwissInput
            id="review-note"
            value={note}
            placeholder="可不填"
            onChange={(event) => onNoteChange(event.target.value)}
          />
        </SwissField>
      </div>

      {factorsError ? (
        <p className="review-accounting-error">
          因子加载失败：{factorsError}
          <button type="button" className="review-accounting-retry" onClick={onReloadFactors}>
            重试
          </button>
        </p>
      ) : null}

      <p className="review-accounting-note">
        活动量与采购金额至少填写一项；购电按 kWh 计入 Scope 2，采购按未税金额计入 Scope 3。
      </p>
    </section>
  )
}
