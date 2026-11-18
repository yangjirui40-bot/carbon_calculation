import { useState } from 'react'
import type { CompanyDetail } from '../../../api/types'
import {
  createUser,
  type AuthUser,
  type CreateUserPayload,
} from '../../../api/modules/auth'
import {
  SwissButton,
  SwissField,
  SwissInput,
  SwissSelect,
} from '../../../components/swiss'
import { USER_ROLE_OPTIONS, type UserRole } from './constants'
import { toErrorMessage } from './errors'

type CreateAccountFormProps = {
  companies: CompanyDetail[]
  companiesLoading: boolean
  companiesError: string | null
  onCreated: (user: AuthUser, payload: CreateUserPayload) => void
}

type FieldErrors = Partial<
  Record<'username' | 'email' | 'password' | 'role' | 'company_id' | 'supplier_id', string>
>

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function companyHint(
  companies: CompanyDetail[],
  loading: boolean,
  error: string | null,
): string {
  if (loading) return '正在加载企业编号…'
  if (error) return `企业列表加载失败：${error}`
  if (companies.length === 0) return '暂无企业；请先在企业管理页创建企业。'
  const shown = companies
    .slice(0, 5)
    .map((company) => `${company.id}（${company.code}）`)
    .join('、')
  return companies.length > 5
    ? `可用企业：${shown} 等 ${companies.length} 家`
    : `可用企业：${shown}`
}

/** 管理员开通任意角色账号；角色切换时只显示对应归属字段 */
export default function CreateAccountForm({
  companies,
  companiesLoading,
  companiesError,
  onCreated,
}: CreateAccountFormProps) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('enterprise')
  const [companyId, setCompanyId] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function validate(): FieldErrors {
    const errors: FieldErrors = {}
    if (username.trim().length < 2) errors.username = '用户名至少 2 个字符'
    if (!EMAIL_PATTERN.test(email.trim())) errors.email = '请填写有效邮箱'
    if (password.length < 6) errors.password = '密码至少 6 个字符'
    if (role === 'enterprise') {
      const parsed = Number(companyId)
      if (!companyId.trim() || !Number.isInteger(parsed) || parsed <= 0) {
        errors.company_id = '企业角色必须填写企业编号'
      }
    }
    if (role === 'supplier' && !supplierId.trim()) {
      errors.supplier_id = '供应商角色必须填写供应商编号'
    }
    return errors
  }

  async function handleSubmit() {
    if (submitting) return
    const errors = validate()
    setFieldErrors(errors)
    setSubmitError(null)
    if (Object.keys(errors).length > 0) return

    const payload: CreateUserPayload = {
      username: username.trim(),
      email: email.trim(),
      password,
      role,
    }
    if (role === 'enterprise') payload.company_id = Number(companyId)
    if (role === 'supplier') payload.supplier_id = supplierId.trim()

    setSubmitting(true)
    try {
      const created = await createUser(payload)
      onCreated(created, payload)
    } catch (error) {
      setSubmitError(toErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      className="users-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void handleSubmit()
      }}
    >
      {submitError ? (
        <div className="users-form__error" role="alert">
          {submitError}
        </div>
      ) : null}

      <SwissField label="用户名" htmlFor="user-username" required error={fieldErrors.username}>
        <SwissInput
          id="user-username"
          value={username}
          autoComplete="off"
          placeholder="登录用户名，如 auditor-test-1108"
          onChange={(event) => setUsername(event.target.value)}
        />
      </SwissField>

      <SwissField label="邮箱" htmlFor="user-email" required error={fieldErrors.email}>
        <SwissInput
          id="user-email"
          type="email"
          value={email}
          autoComplete="off"
          placeholder="name@example.com"
          onChange={(event) => setEmail(event.target.value)}
        />
      </SwissField>

      <SwissField
        label="密码"
        htmlFor="user-password"
        required
        error={fieldErrors.password}
        hint="至少 6 个字符，开通后交给账号使用人"
      >
        <SwissInput
          id="user-password"
          type="password"
          value={password}
          autoComplete="new-password"
          placeholder="初始密码"
          onChange={(event) => setPassword(event.target.value)}
        />
      </SwissField>

      <SwissField label="角色" htmlFor="user-role" required error={fieldErrors.role}>
        <SwissSelect
          id="user-role"
          value={role}
          onChange={(event) => {
            setRole(event.target.value as UserRole)
            setFieldErrors({})
          }}
        >
          {USER_ROLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SwissSelect>
      </SwissField>

      {role === 'enterprise' ? (
        <SwissField
          label="企业编号"
          htmlFor="user-company"
          required
          error={fieldErrors.company_id}
          hint={companyHint(companies, companiesLoading, companiesError)}
        >
          <SwissInput
            id="user-company"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={companyId}
            placeholder="如 1"
            onChange={(event) => setCompanyId(event.target.value)}
          />
        </SwissField>
      ) : null}

      {role === 'supplier' ? (
        <SwissField
          label="供应商编号"
          htmlFor="user-supplier"
          required
          error={fieldErrors.supplier_id}
          hint="供应商编号可在供应链 → 供应商页查看，如 sup-t1-a"
        >
          <SwissInput
            id="user-supplier"
            value={supplierId}
            placeholder="如 sup-t1-a"
            onChange={(event) => setSupplierId(event.target.value)}
          />
        </SwissField>
      ) : null}

      <div className="users-form__actions">
        <SwissButton type="submit" loading={submitting}>
          开通账号
        </SwissButton>
      </div>
    </form>
  )
}
