import { useEffect, useRef, useState } from 'react'
import { productsApi } from '../../../api'
import { SwissButton, SwissDrawer, SwissField, SwissInput } from '../../../components/swiss'
import { errorMessage } from '../labels'
import './BomImportDrawer.css'

type BomImportDrawerProps = {
  open: boolean
  productId: string
  onClose: () => void
  onImported: (imported: number) => void
}

type BomRow = {
  key: number
  bomItemId: string
  materialName: string
  materialAmount: string
  currency: string
}

type FieldErrors = Record<string, string>

function emptyRow(key: number): BomRow {
  return { key, bomItemId: '', materialName: '', materialAmount: '', currency: 'CNY' }
}

/** BOM 导入：表格逐行录入，提交后由后端按 bom_item_id 去重。 */
export default function BomImportDrawer({
  open,
  productId,
  onClose,
  onImported,
}: BomImportDrawerProps) {
  const keyRef = useRef(1)
  const [rows, setRows] = useState<BomRow[]>([emptyRow(0)])
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    keyRef.current = 1
    setRows([emptyRow(0)])
    setFieldErrors({})
    setSubmitError(null)
    setSubmitting(false)
  }, [open])

  function updateRow(key: number, patch: Partial<BomRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  function addRow() {
    const key = keyRef.current
    keyRef.current += 1
    setRows((current) => [...current, emptyRow(key)])
  }

  function removeRow(key: number) {
    setRows((current) => {
      if (current.length <= 1) return [emptyRow(keyRef.current++)]
      return current.filter((row) => row.key !== key)
    })
  }

  async function handleSubmit() {
    if (submitting) return

    const effectiveRows = rows.filter(
      (row) =>
        row.bomItemId.trim() ||
        row.materialName.trim() ||
        row.materialAmount.trim(),
    )
    const errors: FieldErrors = {}
    if (effectiveRows.length === 0) {
      errors.__general = '请至少填写一条 BOM 物料'
    }
    const seen = new Set<string>()
    for (const row of effectiveRows) {
      const id = row.bomItemId.trim()
      if (!id) {
        errors[`${row.key}-id`] = '请填写物料编号'
      } else if (seen.has(id)) {
        errors[`${row.key}-id`] = '物料编号重复'
      } else {
        seen.add(id)
      }
      if (!row.materialName.trim()) errors[`${row.key}-name`] = '请填写物料名称'
      const amount = Number(row.materialAmount)
      if (
        row.materialAmount.trim() === '' ||
        !Number.isFinite(amount) ||
        amount < 0
      ) {
        errors[`${row.key}-amount`] = '金额需不小于 0'
      }
    }

    setFieldErrors(errors)
    setSubmitError(null)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      const result = await productsApi.importBom(
        productId,
        effectiveRows.map((row) => ({
          bom_item_id: row.bomItemId.trim(),
          material_name: row.materialName.trim(),
          material_amount: Number(row.materialAmount),
          currency: row.currency.trim() || 'CNY',
        })),
      )
      onImported(result.imported)
    } catch (error) {
      setSubmitError(errorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SwissDrawer
      open={open}
      title={`导入 BOM · ${productId}`}
      onClose={onClose}
      width={640}
      footer={
        <>
          <SwissButton variant="ghost" onClick={onClose} disabled={submitting}>
            取消
          </SwissButton>
          <SwissButton type="submit" form="bom-import-form" loading={submitting}>
            导入 BOM
          </SwissButton>
        </>
      }
    >
      <form
        id="bom-import-form"
        className="bom-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void handleSubmit()
        }}
      >
        {submitError ? (
          <div className="bom-form__error" role="alert">
            {submitError}
          </div>
        ) : null}
        {fieldErrors.__general ? (
          <div className="bom-form__error" role="alert">
            {fieldErrors.__general}
          </div>
        ) : null}

        <p className="bom-form__note">
          物料金额单位与产品核算口径一致（元）。相同物料编号重复导入时后端会跳过。
        </p>

        <div className="bom-form__rows">
          {rows.map((row) => (
            <div className="bom-form__row" key={row.key}>
              <SwissField
                label="物料编号"
                htmlFor={`bom-id-${row.key}`}
                required
                error={fieldErrors[`${row.key}-id`]}
              >
                <SwissInput
                  id={`bom-id-${row.key}`}
                  value={row.bomItemId}
                  disabled={submitting}
                  placeholder="例如 b004"
                  onChange={(event) => updateRow(row.key, { bomItemId: event.target.value })}
                />
              </SwissField>

              <SwissField
                label="物料名称"
                htmlFor={`bom-name-${row.key}`}
                required
                error={fieldErrors[`${row.key}-name`]}
              >
                <SwissInput
                  id={`bom-name-${row.key}`}
                  value={row.materialName}
                  disabled={submitting}
                  placeholder="例如 电子元器件"
                  onChange={(event) => updateRow(row.key, { materialName: event.target.value })}
                />
              </SwissField>

              <SwissField
                label="金额（元）"
                htmlFor={`bom-amount-${row.key}`}
                required
                error={fieldErrors[`${row.key}-amount`]}
              >
                <SwissInput
                  id={`bom-amount-${row.key}`}
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={row.materialAmount}
                  disabled={submitting}
                  placeholder="0"
                  onChange={(event) => updateRow(row.key, { materialAmount: event.target.value })}
                />
              </SwissField>

              <SwissField label="币种" htmlFor={`bom-currency-${row.key}`}>
                <SwissInput
                  id={`bom-currency-${row.key}`}
                  value={row.currency}
                  disabled={submitting}
                  onChange={(event) => updateRow(row.key, { currency: event.target.value })}
                />
              </SwissField>

              <div className="bom-form__remove">
                <SwissButton
                  variant="ghost"
                  aria-label={`删除第 ${row.key + 1} 行`}
                  disabled={submitting}
                  onClick={() => removeRow(row.key)}
                >
                  删除
                </SwissButton>
              </div>
            </div>
          ))}
        </div>

        <SwissButton variant="ghost" disabled={submitting} onClick={addRow}>
          + 添加一行
        </SwissButton>
      </form>
    </SwissDrawer>
  )
}
