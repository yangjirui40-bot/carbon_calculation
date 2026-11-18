import { ApiRequestError } from '../../api'

/** 展示后端 detail 原文；非接口异常回退到页面文案 */
export function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiRequestError) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export function isNotFoundError(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status === 404
}
