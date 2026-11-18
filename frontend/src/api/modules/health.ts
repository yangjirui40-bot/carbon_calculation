import { request } from '../client'
import type { HealthResponse } from '../types'

/** 联调第一天先用它确认前后端连通；/healthz 不带 /api/v1 前缀 */
export function getHealth() {
  return request<HealthResponse>({
    url: '/healthz',
    method: 'get',
  })
}
