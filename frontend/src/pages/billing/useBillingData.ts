import { useCallback, useEffect, useState } from 'react'
import { billingApi } from '../../api'
import type { BillingPlan, SubscriptionInfo } from '../../api/types'
import { toErrorMessage } from './errors'

/** 套餐列表与企业订阅各自维护加载/错误；切换企业时重新拉订阅 */
export function useBillingData(companyId: number | null) {
  const [plans, setPlans] = useState<BillingPlan[]>([])
  const [plansLoading, setPlansLoading] = useState(true)
  const [plansError, setPlansError] = useState<string | null>(null)

  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const [subscriptionLoading, setSubscriptionLoading] = useState(companyId !== null)
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null)

  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    setPlansLoading(true)
    setPlansError(null)
    billingApi
      .listPlans()
      .then((list) => {
        if (!active) return
        setPlans(list)
        setPlansLoading(false)
      })
      .catch((error: unknown) => {
        if (!active) return
        setPlansError(toErrorMessage(error))
        setPlansLoading(false)
      })
    return () => {
      active = false
    }
  }, [reloadKey])

  useEffect(() => {
    if (companyId === null) {
      setSubscription(null)
      setSubscriptionLoading(false)
      setSubscriptionError(null)
      return
    }

    let active = true
    // 切换企业时先清掉旧订阅，避免套餐“当前”标记与按钮沿用上一家企业
    setSubscription(null)
    setSubscriptionLoading(true)
    setSubscriptionError(null)
    billingApi
      .getSubscription(companyId)
      .then((info) => {
        if (!active) return
        setSubscription(info)
        setSubscriptionLoading(false)
      })
      .catch((error: unknown) => {
        if (!active) return
        setSubscription(null)
        setSubscriptionError(toErrorMessage(error))
        setSubscriptionLoading(false)
      })
    return () => {
      active = false
    }
  }, [companyId, reloadKey])

  const reload = useCallback(() => setReloadKey((key) => key + 1), [])

  return {
    plans,
    plansLoading,
    plansError,
    subscription,
    subscriptionLoading,
    subscriptionError,
    reload,
  }
}
