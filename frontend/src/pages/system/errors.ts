import { ApiRequestError } from '../../api'

/** 权限/网络错误原样展示，不伪造任务或状态数据 */
export function toErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message
  if (error instanceof Error && error.message) return error.message
  return '请求失败，请稍后重试'
}
