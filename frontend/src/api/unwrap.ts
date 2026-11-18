import type { ApiError } from './types'

/** 把任意异常统一成可直接展示的中文错误 */
export function normalizeError(error: unknown): ApiError {
  if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error) {
    return error as ApiError
  }
  if (error instanceof Error) {
    return { code: 'UNKNOWN_ERROR', message: error.message }
  }
  return { code: 'UNKNOWN_ERROR', message: '请求失败，请稍后重试' }
}
