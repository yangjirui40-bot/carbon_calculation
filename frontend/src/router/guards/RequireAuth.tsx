import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { isRole, type Role } from '../../config/roles'

/**
 * 会话契约（T4 负责写入，T3 只读，不共享 helper 文件）：
 * localStorage key：carbonspeed.session
 * value：{ token, user: { id, username, email?, role, company_id } }
 */
export const SESSION_STORAGE_KEY = 'carbonspeed.session'

export type SessionUser = {
  id: number
  username: string
  email?: string
  role: Role
  company_id: number | null
}

export type Session = {
  token: string
  user: SessionUser
}

/** 解析失败、缺少 token 或角色非法都视为未登录 */
export function readSession(): Session | null {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null

    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null

    const { token, user } = parsed as { token?: unknown; user?: unknown }
    if (typeof token !== 'string' || token.length === 0) return null
    if (!user || typeof user !== 'object') return null

    const fields = user as Record<string, unknown>
    if (!isRole(fields.role)) return null

    return {
      token,
      user: {
        id: typeof fields.id === 'number' ? fields.id : Number(fields.id) || 0,
        username: typeof fields.username === 'string' ? fields.username : '',
        email: typeof fields.email === 'string' ? fields.email : undefined,
        role: fields.role,
        company_id: typeof fields.company_id === 'number' ? fields.company_id : null,
      },
    }
  } catch {
    return null
  }
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY)
  } catch {
    // 忽略存储不可用；跳转登录仍会执行
  }
}

/** 无有效会话时跳登录，并记录原始目标路径供登录后回跳 */
export default function RequireAuth() {
  const location = useLocation()

  if (!readSession()) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}
