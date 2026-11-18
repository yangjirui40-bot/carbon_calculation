import { request } from '../client'

/** 后端 UserOut（交付文档「认证」章节） */
export interface AuthUser {
  id: number
  username: string
  email: string
  role: 'admin' | 'enterprise' | 'auditor' | 'supplier'
  company_id: number | null
  is_active?: boolean
}

export interface LoginResponse {
  access_token: string
  token_type: string
  user: AuthUser
}

export interface StoredSession {
  token: string
  user: AuthUser
}

/** POST /auth/users 请求体（仅管理员） */
export interface CreateUserPayload {
  username: string
  email: string
  password: string
  role: 'admin' | 'enterprise' | 'supplier' | 'auditor'
  company_id?: number | null
  supplier_id?: string | null
}

/** 会话存储键：T3 路由守卫与 T4 页面共用，改名需同步 */
export const SESSION_KEY = 'carbonspeed.session'

/** OAuth2 表单登录；后端返回 401/429，detail 由 request 归一成 ApiRequestError.message */
export function login(username: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>({
    url: '/api/v1/auth/login',
    method: 'post',
    data: new URLSearchParams({ username, password }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
}

/** 自助注册仅允许 enterprise 角色；company_id 为空时不发送 */
export function register(payload: {
  username: string
  email: string
  password: string
  role?: 'enterprise'
  company_id?: number | null
}): Promise<AuthUser> {
  const body: Record<string, string | number> = {
    username: payload.username,
    email: payload.email,
    password: payload.password,
    role: 'enterprise',
  }
  if (payload.company_id !== undefined && payload.company_id !== null) {
    body.company_id = payload.company_id
  }
  return request<AuthUser>({
    url: '/api/v1/auth/register',
    method: 'post',
    data: body,
  })
}

/** 管理员开通任意角色账号；后端无账号列表接口 */
export function createUser(payload: CreateUserPayload): Promise<AuthUser> {
  return request<AuthUser>({
    url: '/api/v1/auth/users',
    method: 'post',
    data: payload,
  })
}

/** 写入 localStorage：{ token, user }，供 T3 守卫读取 */
export function saveSession(data: LoginResponse): void {
  const session: StoredSession = { token: data.access_token, user: data.user }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function readSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { token?: unknown; user?: unknown }
    if (typeof parsed?.token !== 'string' || !parsed.token) return null
    if (typeof parsed.user !== 'object' || parsed.user === null) return null
    return { token: parsed.token, user: parsed.user as AuthUser }
  } catch {
    return null
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}
