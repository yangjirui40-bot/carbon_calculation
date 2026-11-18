import { ApiRequestError } from '../../../api'

/** 后端 detail 已由 client 归一成 message；原样展示，不覆盖为通用文案 */
export function toErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message
  if (error instanceof Error && error.message) return error.message
  return '请求失败，请稍后重试'
}
