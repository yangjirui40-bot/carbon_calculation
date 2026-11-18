/** 统一取后端 ApiRequestError.message 展示；未知异常用兜底文案。 */
export function errorText(error: unknown, fallback = '请求失败，请稍后重试'): string {
  return error instanceof Error && error.message ? error.message : fallback
}
