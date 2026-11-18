import { ApiRequestError } from '../../api'

/** 统一把请求异常转成可展示文案；后端 detail 已由 client 提取到 message */
export function toErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message
  if (error instanceof Error) return error.message
  return '请求失败，请稍后重试'
}
