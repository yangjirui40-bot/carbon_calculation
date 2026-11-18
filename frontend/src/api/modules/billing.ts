import { request } from '../client'
import type { BillingPlan, SubscriptionInfo } from '../types'

export function listPlans() {
  return request<BillingPlan[]>({
    url: '/api/v1/billing/plans',
    method: 'get',
  })
}

/** 付费套餐仅管理员可开通；free 可由企业自行切换 */
export function subscribe(companyId: number, planCode: string) {
  return request<{
    company_id: number
    plan_code: string
    status: string
    start_date: string
    end_date: string
  }>({
    url: '/api/v1/billing/subscribe',
    method: 'post',
    data: { company_id: companyId, plan_code: planCode },
  })
}

export function getSubscription(companyId: number) {
  return request<SubscriptionInfo>({
    url: `/api/v1/billing/company/${companyId}/subscription`,
    method: 'get',
  })
}
