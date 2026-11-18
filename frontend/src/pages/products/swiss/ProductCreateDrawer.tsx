import { useEffect, useState } from 'react'
import { productsApi } from '../../../api'
import type { CompanyDetail, ProductRecord } from '../../../api/types'
import {
  SwissButton,
  SwissDrawer,
  SwissField,
  SwissInput,
  SwissSelect,
  SwissTextarea,
} from '../../../components/swiss'
import { errorMessage } from '../labels'
import './ProductCreateDrawer.css'

type ProductCreateDrawerProps = {
  open: boolean
  companies: CompanyDetail[]
  defaultCompanyId: number | null
  onClose: () => void
  onCreated: (product: ProductRecord) => void
}

type FieldErrors = Record<string, string>

const PRODUCT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/

/** 新建产品档案；产品编号由后端做唯一性校验。 */
export default function ProductCreateDrawer({
  open,
  companies,
  defaultCompanyId,
  onClose,
  onCreated,
}: ProductCreateDrawerProps) {
  const [productId, setProductId] = useState('')
  const [productName, setProductName] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [outputQuantity, setOutputQuantity] = useState('')
  const [productUnit, setProductUnit] = useState('件')
  const [description, setDescription] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setProductId('')
    setProductName('')
    setCompanyId(defaultCompanyId === null ? '' : String(defaultCompanyId))
    setOutputQuantity('')
    setProductUnit('件')
    setDescription('')
    setFieldErrors({})
    setSubmitError(null)
    setSubmitting(false)
  }, [open, defaultCompanyId])

  function validate(): FieldErrors {
    const errors: FieldErrors = {}
    if (!productId.trim()) {
      errors.product_id = '请填写产品编号'
    } else if (!PRODUCT_ID_PATTERN.test(productId.trim())) {
      errors.product_id = '编号以字母或数字开头，可含 . _ -，最长 40 位'
    }
    if (!productName.trim()) errors.product_name = '请填写产品名称'
    if (!companyId) errors.company_id = '请选择所属企业'
    const quantity = Number(outputQuantity)
    if (outputQuantity.trim() === '' || !Number.isFinite(quantity) || quantity <= 0) {
      errors.output_quantity = '产量需为大于 0 的数值'
    }
    if (!productUnit.trim()) errors.product_unit = '请填写计量单位'
    return errors
  }

  async function handleSubmit() {
    if (submitting) return
    const errors = validate()
    setFieldErrors(errors)
    setSubmitError(null)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      const created = await productsApi.createProduct({
        product_id: productId.trim(),
        product_name: productName.trim(),
        company_id: Number(companyId),
        output_quantity: Number(outputQuantity),
        product_unit: productUnit.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
      })
      onCreated(created)
    } catch (error) {
      setSubmitError(errorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SwissDrawer
      open={open}
      title="新建产品"
      onClose={onClose}
      width={460}
      footer={
        <>
          <SwissButton variant="ghost" onClick={onClose} disabled={submitting}>
            取消
          </SwissButton>
          <SwissButton type="submit" form="product-create-form" loading={submitting}>
            保存产品
          </SwissButton>
        </>
      }
    >
      <form
        id="product-create-form"
        className="product-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void handleSubmit()
        }}
      >
        {submitError ? (
          <div className="product-form__error" role="alert">
            {submitError}
          </div>
        ) : null}

        <SwissField
          label="产品编号"
          htmlFor="product-id"
          required
          error={fieldErrors.product_id}
          hint="用于核算与报告引用，创建后不可修改"
        >
          <SwissInput
            id="product-id"
            value={productId}
            disabled={submitting}
            placeholder="例如 p002"
            onChange={(event) => {
              setProductId(event.target.value)
              if (fieldErrors.product_id) {
                setFieldErrors((current) => ({ ...current, product_id: '' }))
              }
            }}
          />
        </SwissField>

        <SwissField
          label="产品名称"
          htmlFor="product-name"
          required
          error={fieldErrors.product_name}
        >
          <SwissInput
            id="product-name"
            value={productName}
            disabled={submitting}
            placeholder="例如 控制板模块"
            onChange={(event) => {
              setProductName(event.target.value)
              if (fieldErrors.product_name) {
                setFieldErrors((current) => ({ ...current, product_name: '' }))
              }
            }}
          />
        </SwissField>

        <SwissField label="所属企业" htmlFor="product-company" required error={fieldErrors.company_id}>
          {defaultCompanyId === null ? (
            <SwissSelect
              id="product-company"
              value={companyId}
              disabled={submitting}
              onChange={(event) => {
                setCompanyId(event.target.value)
                if (fieldErrors.company_id) {
                  setFieldErrors((current) => ({ ...current, company_id: '' }))
                }
              }}
            >
              <option value="">请选择企业</option>
              {companies.map((company) => (
                <option key={company.id} value={String(company.id)}>
                  {company.name}（{company.code}）
                </option>
              ))}
            </SwissSelect>
          ) : (
            <SwissInput
              id="product-company"
              value={
                companies.find((company) => company.id === defaultCompanyId)?.name ??
                `企业 #${defaultCompanyId}`
              }
              readOnly
              disabled
            />
          )}
        </SwissField>

        <div className="product-form__row">
          <SwissField
            label="产量"
            htmlFor="product-quantity"
            required
            error={fieldErrors.output_quantity}
          >
            <SwissInput
              id="product-quantity"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={outputQuantity}
              disabled={submitting}
              placeholder="例如 1000"
              onChange={(event) => {
                setOutputQuantity(event.target.value)
                if (fieldErrors.output_quantity) {
                  setFieldErrors((current) => ({ ...current, output_quantity: '' }))
                }
              }}
            />
          </SwissField>

          <SwissField label="单位" htmlFor="product-unit" required error={fieldErrors.product_unit}>
            <SwissInput
              id="product-unit"
              value={productUnit}
              disabled={submitting}
              placeholder="件"
              onChange={(event) => {
                setProductUnit(event.target.value)
                if (fieldErrors.product_unit) {
                  setFieldErrors((current) => ({ ...current, product_unit: '' }))
                }
              }}
            />
          </SwissField>
        </div>

        <SwissField label="说明" htmlFor="product-description" hint="选填，最多 200 字">
          <SwissTextarea
            id="product-description"
            rows={3}
            maxLength={200}
            value={description}
            disabled={submitting}
            placeholder="产品用途或核算边界说明"
            onChange={(event) => setDescription(event.target.value)}
          />
        </SwissField>
      </form>
    </SwissDrawer>
  )
}
