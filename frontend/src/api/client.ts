import axios, { type AxiosRequestConfig } from 'axios'
import type { ApiError } from './types'
import { normalizeError } from './unwrap'

export class ApiRequestError extends Error {
  code: string
  status?: number

  constructor(error: ApiError, status?: number) {
    super(error.message)
    this.name = 'ApiRequestError'
    this.code = error.code
    this.status = status
  }
}

/** 后端地址只取 origin；/api/v1 由各模块显式写在路径里，/healthz 例外 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

/** 与 T4 认证模块约定的会话键，值为 { token, user } */
const SESSION_STORAGE_KEY = 'carbonspeed.session'

const AUTH_ENTRY_PATHS = ['/api/v1/auth/login', '/api/v1/auth/register']

export const http = axios.create({
  baseURL: API_BASE_URL,
  // OCR 解析等长任务由调用方单独放宽超时
  timeout: 30_000,
})

function isAuthEntry(url: string | undefined): boolean {
  if (!url) return false
  return AUTH_ENTRY_PATHS.some((path) => url.startsWith(path))
}

function readToken(): string | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { token?: unknown }
    return typeof parsed.token === 'string' && parsed.token ? parsed.token : null
  } catch {
    return null
  }
}

function clearStoredSession(): void {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY)
  } catch {
    // 隐私模式下 localStorage 可能不可用，忽略即可
  }
}

function redirectToLogin(): void {
  if (typeof window === 'undefined') return
  if (window.location.pathname === '/login') return
  window.location.assign('/login')
}

/** 请求拦截：除登录/注册外自动附带 Bearer Token */
http.interceptors.request.use((config) => {
  if (isAuthEntry(config.url)) return config
  const token = readToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

interface FastAPIDetailItem {
  loc?: unknown
  msg?: unknown
}

/** 把 FastAPI 的 { detail: string | ValidationError[] } 转成一句可展示的中文 */
function extractErrorMessage(status: number, body: unknown): string {
  if (typeof body === 'object' && body !== null && 'detail' in body) {
    const detail = (body as { detail?: unknown }).detail
    if (typeof detail === 'string' && detail) return detail
    if (Array.isArray(detail)) {
      const parts = (detail as FastAPIDetailItem[])
        .map((item) => {
          const field = Array.isArray(item.loc) ? item.loc.slice(1).join('.') : ''
          const message = typeof item.msg === 'string' ? item.msg : ''
          if (!message) return ''
          return field ? `${field}：${message}` : message
        })
        .filter(Boolean)
      if (parts.length) return parts.join('；')
    }
  }
  return `请求失败（HTTP ${status}）`
}

/**
 * 统一请求入口：
 * - 后端无信封，直接返回响应体；
 * - HTTP 错误、网络错误统一成 ApiRequestError；
 * - 401 清除本地会话并跳转登录（登录/注册接口除外）。
 */
export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const response = await http.request<T>(config)
    return response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (!error.response) {
        throw new ApiRequestError({
          code: 'NETWORK_ERROR',
          message: `无法连接后端服务，请确认服务已启动（${API_BASE_URL}）`,
        })
      }
      const status = error.response.status
      const message = extractErrorMessage(status, error.response.data)
      if (status === 401 && !isAuthEntry(config.url)) {
        clearStoredSession()
        redirectToLogin()
      }
      throw new ApiRequestError({ code: `HTTP_${status}`, message }, status)
    }
    throw new ApiRequestError(normalizeError(error))
  }
}

/** 文件下载（报告 PDF/XML 等二进制响应） */
export async function download(config: AxiosRequestConfig): Promise<Blob> {
  try {
    const response = await http.request<Blob>({ ...config, responseType: 'blob' })
    return response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (!error.response) {
        throw new ApiRequestError({
          code: 'NETWORK_ERROR',
          message: `无法连接后端服务，请确认服务已启动（${API_BASE_URL}）`,
        })
      }
      const status = error.response.status
      let body: unknown = error.response.data
      // blob 响应里的错误体需要先读成文本才能解析 detail
      if (body instanceof Blob) {
        try {
          body = JSON.parse(await body.text())
        } catch {
          body = undefined
        }
      }
      if (status === 401 && !isAuthEntry(config.url)) {
        clearStoredSession()
        redirectToLogin()
      }
      throw new ApiRequestError({ code: `HTTP_${status}`, message: extractErrorMessage(status, body) }, status)
    }
    throw new ApiRequestError(normalizeError(error))
  }
}
