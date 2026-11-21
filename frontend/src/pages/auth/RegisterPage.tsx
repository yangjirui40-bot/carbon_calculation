import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiRequestError } from '../../api/client'
import { register } from '../../api/modules/auth'
import './RegisterPage.css'

type FieldName = 'username' | 'email' | 'password' | 'confirm' | 'company'
type FieldErrors = Partial<Record<FieldName, string>>

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function RegisterPage() {
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [company, setCompany] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function validate(): FieldErrors {
    const next: FieldErrors = {}
    const name = username.trim()
    if (name.length < 2 || name.length > 64) {
      next.username = '用户名需为 2—64 个字符'
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      next.email = '请输入有效的邮箱地址'
    }
    if (password.length < 6) {
      next.password = '密码至少 6 位'
    }
    if (confirm !== password) {
      next.confirm = '两次输入的密码不一致'
    }
    const companyCode = company.trim()
    if (companyCode !== '' && (companyCode.length < 2 || companyCode.length > 255)) {
      next.company = '企业名称需为2—255个字符'
    }
    return next
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    setError(null)
    const nextErrors = validate()
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    try {
      const companyCode = company.trim()
      await register({
        username: username.trim(),
        email: email.trim(),
        password,
        company_name: companyCode || undefined,
      })
      navigate('/login', {
        replace: true,
        state: { username: username.trim(), registered: true },
      })
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message)
      } else {
        setError('注册失败，请稍后再试')
      }
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-swiss auth-register">
      <div className="auth-split">
        <aside className="auth-brand">
          <div className="auth-brand-top">
            <span className="auth-brand-mark" aria-hidden="true" />
            <span className="auth-brand-kicker">Carbon Ledger / Register</span>
          </div>

          <div className="auth-brand-main">
            <h1 className="auth-brand-title">碳速算</h1>
            <p className="auth-brand-sub">电子信息制造业碳核算平台</p>
            <div className="auth-brand-geometry" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
          </div>

          <div className="auth-brand-foot">
            <span>Enterprise Account</span>
            <span>Carbon Accounting</span>
          </div>
        </aside>

        <main className="auth-panel">
          <div className="auth-form-box">
            <header className="auth-head">
              <div className="auth-kicker">Account / 02</div>
              <h2>企业注册</h2>
              <p>创建企业账号，注册后使用该账号登录工作台。</p>
            </header>

            {error ? (
              <p className="auth-error" role="alert">
                {error}
              </p>
            ) : null}

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              <div className="auth-field">
                <label className="auth-label" htmlFor="register-username">
                  <span>用户名</span>
                  <span className="auth-label-en">Username</span>
                </label>
                <input
                  id="register-username"
                  className="auth-input"
                  type="text"
                  autoComplete="username"
                  value={username}
                  aria-invalid={fieldErrors.username ? true : undefined}
                  aria-describedby={fieldErrors.username ? 'register-username-error' : undefined}
                  onChange={(event) => setUsername(event.target.value)}
                />
                {fieldErrors.username ? (
                  <span className="auth-field-error" id="register-username-error">
                    {fieldErrors.username}
                  </span>
                ) : null}
              </div>

              <div className="auth-field">
                <label className="auth-label" htmlFor="register-email">
                  <span>邮箱</span>
                  <span className="auth-label-en">Email</span>
                </label>
                <input
                  id="register-email"
                  className="auth-input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  aria-invalid={fieldErrors.email ? true : undefined}
                  aria-describedby={fieldErrors.email ? 'register-email-error' : undefined}
                  onChange={(event) => setEmail(event.target.value)}
                />
                {fieldErrors.email ? (
                  <span className="auth-field-error" id="register-email-error">
                    {fieldErrors.email}
                  </span>
                ) : null}
              </div>

              <div className="auth-field">
                <label className="auth-label" htmlFor="register-password">
                  <span>密码</span>
                  <span className="auth-label-en">Password</span>
                </label>
                <input
                  id="register-password"
                  className="auth-input"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  aria-invalid={fieldErrors.password ? true : undefined}
                  aria-describedby={fieldErrors.password ? 'register-password-error' : undefined}
                  onChange={(event) => setPassword(event.target.value)}
                />
                {fieldErrors.password ? (
                  <span className="auth-field-error" id="register-password-error">
                    {fieldErrors.password}
                  </span>
                ) : null}
              </div>

              <div className="auth-field">
                <label className="auth-label" htmlFor="register-confirm">
                  <span>确认密码</span>
                  <span className="auth-label-en">Confirm Password</span>
                </label>
                <input
                  id="register-confirm"
                  className="auth-input"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  aria-invalid={fieldErrors.confirm ? true : undefined}
                  aria-describedby={fieldErrors.confirm ? 'register-confirm-error' : undefined}
                  onChange={(event) => setConfirm(event.target.value)}
                />
                {fieldErrors.confirm ? (
                  <span className="auth-field-error" id="register-confirm-error">
                    {fieldErrors.confirm}
                  </span>
                ) : null}
              </div>

              <div className="auth-field">
                <label className="auth-label" htmlFor="register-company">
                  <span>企业名称（选填）</span>
                  <span className="auth-label-en">Company name</span>
                </label>
                <input
                  id="register-company"
                  className="auth-input"
                  type="text"
                  inputMode="text"
                  value={company}
                  aria-invalid={fieldErrors.company ? true : undefined}
                  aria-describedby={fieldErrors.company ? 'register-company-error' : 'register-company-hint'}
                  onChange={(event) => setCompany(event.target.value)}
                />
                {fieldErrors.company ? (
                  <span className="auth-field-error" id="register-company-error">
                    {fieldErrors.company}
                  </span>
                ) : (
                  <span className="auth-hint" id="register-company-hint">
                    注册后创建独立企业空间；加入已有企业请联系管理员开通
                  </span>
                )}
              </div>

              <button
                type="submit"
                className="auth-submit"
                disabled={submitting}
                data-loading={submitting ? 'true' : undefined}
              >
                <span>{submitting ? '提交中…' : '注册'}</span>
                <span className="auth-submit-mark" aria-hidden="true">
                  {submitting ? '···' : '→'}
                </span>
              </button>
            </form>

            <footer className="auth-switch">
              <span>已有账号？</span>
              <Link to="/login">返回登录</Link>
            </footer>
          </div>

          <div className="auth-panel-foot">
            <span>碳速算 · Carbon Ledger</span>
            <span>电子信息制造业碳核算平台</span>
          </div>
        </main>
      </div>
    </div>
  )
}
