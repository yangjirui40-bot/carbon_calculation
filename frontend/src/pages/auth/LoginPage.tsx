import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ApiRequestError } from '../../api/client'
import { login, saveSession } from '../../api/modules/auth'
import './LoginPage.css'

interface LoginState {
  /** T3 守卫跳转时记录的原目标路径 */
  from?: { pathname?: string }
  /** 注册成功跳转时带回的用户名 */
  username?: string
  registered?: boolean
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state ?? null) as LoginState | null

  const [username, setUsername] = useState(state?.username ?? '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    const name = username.trim()
    if (!name || !password) {
      setError('请输入用户名和密码')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const data = await login(name, password)
      saveSession(data)
      const from = state?.from?.pathname
      const target =
        from && from !== '/login' ? from : data.user.role === 'supplier' ? '/supplier' : '/workspace'
      navigate(target, { replace: true })
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.status === 429 ? '请求过于频繁，请稍后再试' : err.message)
      } else {
        setError('登录失败，请稍后再试')
      }
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-swiss auth-login">
      <div className="auth-split">
        <aside className="auth-brand">
          <div className="auth-brand-top">
            <span className="auth-brand-mark" aria-hidden="true" />
            <span className="auth-brand-kicker">Carbon Ledger / Sign in</span>
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
            <span>Scope 1 / 2 / 3</span>
            <span>Carbon Accounting</span>
          </div>
        </aside>

        <main className="auth-panel">
          <div className="auth-form-box">
            <header className="auth-head">
              <div className="auth-kicker">Account / 01</div>
              <h2>登录</h2>
              <p>使用企业账号进入工作台，继续碳核算流程。</p>
            </header>

            {state?.registered ? (
              <p className="auth-notice" role="status">
                注册成功，请登录
              </p>
            ) : null}

            {error ? (
              <p className="auth-error" role="alert">
                {error}
              </p>
            ) : null}

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              <div className="auth-field">
                <label className="auth-label" htmlFor="login-username">
                  <span>用户名</span>
                  <span className="auth-label-en">Username</span>
                </label>
                <input
                  id="login-username"
                  className="auth-input"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                />
              </div>

              <div className="auth-field">
                <label className="auth-label" htmlFor="login-password">
                  <span>密码</span>
                  <span className="auth-label-en">Password</span>
                </label>
                <div className="auth-password">
                  <input
                    id="login-password"
                    className="auth-input"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    className="auth-toggle"
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((visible) => !visible)}
                  >
                    {showPassword ? '隐藏' : '显示'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="auth-submit"
                disabled={submitting}
                data-loading={submitting ? 'true' : undefined}
              >
                <span>{submitting ? '登录中…' : '登录'}</span>
                <span className="auth-submit-mark" aria-hidden="true">
                  {submitting ? '···' : '→'}
                </span>
              </button>
            </form>

            <footer className="auth-switch">
              <span>没有企业账号？</span>
              <Link to="/register">企业注册</Link>
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
