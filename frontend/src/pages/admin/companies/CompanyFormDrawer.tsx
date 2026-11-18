import { useEffect, useState } from 'react'
import { companiesApi } from '../../../api'
import type {
  CompanyCreatePayload,
  CompanyDetail,
  CompanyUpdatePayload,
} from '../../../api/types'
import {
  SwissButton,
  SwissDrawer,
  SwissField,
  SwissInput,
  SwissTextarea,
} from '../../../components/swiss'
import { toErrorMessage } from './errors'

export type CompanyFormMode = 'create' | 'edit'

type CompanyFormDrawerProps = {
  open: boolean
  mode: CompanyFormMode
  company: CompanyDetail | null
  onClose: () => void
  onSaved: (company: CompanyDetail, mode: CompanyFormMode) => void
}

type CompanyFormState = {
  code: string
  name: string
  industry: string
  region: string
  scale: string
  contact_name: string
  contact_phone: string
  contact_email: string
  description: string
}

type FieldErrors = Partial<Record<keyof CompanyFormState, string>>

const EMPTY_FORM: CompanyFormState = {
  code: '',
  name: '',
  industry: '',
  region: '',
  scale: '',
  contact_name: '',
  contact_phone: '',
  contact_email: '',
  description: '',
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function formFromCompany(company: CompanyDetail | null): CompanyFormState {
  if (!company) return { ...EMPTY_FORM }
  return {
    code: company.code,
    name: company.name,
    industry: company.industry ?? '',
    region: company.region ?? '',
    scale: company.scale ?? '',
    contact_name: company.contact_name ?? '',
    contact_phone: company.contact_phone ?? '',
    contact_email: company.contact_email ?? '',
    description: company.description ?? '',
  }
}

/** 新建/编辑企业；code 创建后不可改，可选字段留空则不提交 */
export default function CompanyFormDrawer({
  open,
  mode,
  company,
  onClose,
  onSaved,
}: CompanyFormDrawerProps) {
  const [form, setForm] = useState<CompanyFormState>(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(formFromCompany(mode === 'edit' ? company : null))
    setFieldErrors({})
    setSubmitError(null)
    setSubmitting(false)
  }, [open, mode, company])

  function updateField<K extends keyof CompanyFormState>(key: K, value: string) {
    setForm((previous) => ({ ...previous, [key]: value }))
  }

  function validate(): FieldErrors {
    const errors: FieldErrors = {}
    if (mode === 'create' && !form.code.trim()) errors.code = '请填写企业编号'
    if (!form.name.trim()) errors.name = '请填写企业名称'
    if (form.contact_email.trim() && !EMAIL_PATTERN.test(form.contact_email.trim())) {
      errors.contact_email = '邮箱格式不正确'
    }
    return errors
  }

  /** 新建时留空字段不发送（后端用默认值）；编辑时发送全部字段，允许清空可选值 */
  function optionalFields(includeEmpty: boolean): CompanyUpdatePayload {
    const payload: CompanyUpdatePayload = {}
    if (includeEmpty || form.industry.trim()) payload.industry = form.industry.trim()
    if (includeEmpty || form.region.trim()) payload.region = form.region.trim()
    if (includeEmpty || form.scale.trim()) payload.scale = form.scale.trim()
    if (includeEmpty || form.contact_name.trim()) {
      payload.contact_name = form.contact_name.trim()
    }
    if (includeEmpty || form.contact_phone.trim()) {
      payload.contact_phone = form.contact_phone.trim()
    }
    if (includeEmpty || form.contact_email.trim()) {
      payload.contact_email = form.contact_email.trim()
    }
    if (includeEmpty || form.description.trim()) {
      payload.description = form.description.trim()
    }
    return payload
  }

  async function handleSubmit() {
    if (submitting) return
    const errors = validate()
    setFieldErrors(errors)
    setSubmitError(null)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      if (mode === 'create') {
        const payload: CompanyCreatePayload = {
          code: form.code.trim(),
          name: form.name.trim(),
          ...optionalFields(false),
        }
        const created = await companiesApi.createCompany(payload)
        onSaved(created, mode)
      } else if (company) {
        const payload: CompanyUpdatePayload = {
          name: form.name.trim(),
          ...optionalFields(true),
        }
        const updated = await companiesApi.updateCompany(company.id, payload)
        onSaved(updated, mode)
      }
    } catch (error) {
      setSubmitError(toErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SwissDrawer
      open={open}
      title={mode === 'create' ? '新建企业' : '编辑企业'}
      onClose={onClose}
      width={480}
      footer={
        <>
          <SwissButton variant="ghost" onClick={onClose} disabled={submitting}>
            取消
          </SwissButton>
          <SwissButton type="submit" form="company-form" loading={submitting}>
            {mode === 'create' ? '保存企业' : '保存修改'}
          </SwissButton>
        </>
      }
    >
      <form
        id="company-form"
        className="companies-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void handleSubmit()
        }}
      >
        {submitError ? (
          <div className="companies-form__error" role="alert">
            {submitError}
          </div>
        ) : null}

        <SwissField
          label="企业编号"
          htmlFor="company-code"
          required={mode === 'create'}
          error={fieldErrors.code}
          hint={mode === 'edit' ? '企业编号创建后不可修改' : undefined}
        >
          <SwissInput
            id="company-code"
            value={form.code}
            placeholder="如 w9-test-001"
            disabled={mode === 'edit'}
            onChange={(event) => updateField('code', event.target.value)}
          />
        </SwissField>

        <SwissField label="企业名称" htmlFor="company-name" required error={fieldErrors.name}>
          <SwissInput
            id="company-name"
            value={form.name}
            placeholder="如 湖南湘芯传感器制造有限公司"
            onChange={(event) => updateField('name', event.target.value)}
          />
        </SwissField>

        <SwissField label="行业" htmlFor="company-industry">
          <SwissInput
            id="company-industry"
            value={form.industry}
            placeholder="如 智能传感器制造"
            onChange={(event) => updateField('industry', event.target.value)}
          />
        </SwissField>

        <SwissField label="地区" htmlFor="company-region">
          <SwissInput
            id="company-region"
            value={form.region}
            placeholder="如 湖南省长沙市"
            onChange={(event) => updateField('region', event.target.value)}
          />
        </SwissField>

        <SwissField label="规模" htmlFor="company-scale">
          <SwissInput
            id="company-scale"
            value={form.scale}
            placeholder="如 中型"
            onChange={(event) => updateField('scale', event.target.value)}
          />
        </SwissField>

        <SwissField label="联系人" htmlFor="company-contact-name">
          <SwissInput
            id="company-contact-name"
            value={form.contact_name}
            placeholder="联系人姓名"
            onChange={(event) => updateField('contact_name', event.target.value)}
          />
        </SwissField>

        <SwissField label="联系电话" htmlFor="company-contact-phone">
          <SwissInput
            id="company-contact-phone"
            value={form.contact_phone}
            placeholder="手机或座机"
            onChange={(event) => updateField('contact_phone', event.target.value)}
          />
        </SwissField>

        <SwissField
          label="联系邮箱"
          htmlFor="company-contact-email"
          error={fieldErrors.contact_email}
        >
          <SwissInput
            id="company-contact-email"
            type="email"
            value={form.contact_email}
            placeholder="contact@example.com"
            onChange={(event) => updateField('contact_email', event.target.value)}
          />
        </SwissField>

        <div className="companies-form__full">
          <SwissField label="备注" htmlFor="company-description">
            <SwissTextarea
              id="company-description"
              rows={3}
              value={form.description}
              placeholder="企业简介或备注，可不填"
              onChange={(event) => updateField('description', event.target.value)}
            />
          </SwissField>
        </div>
      </form>
    </SwissDrawer>
  )
}
