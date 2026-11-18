import { ApiRequestError } from '../../../api'

/** 后端 detail（用户名已存在、密码过短等）原样展示 */
export function toErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message
  if (error instanceof Error && error.message) return error.message
  return '请求失败，请稍后重试'
}
