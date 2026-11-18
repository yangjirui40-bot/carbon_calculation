import { lazy } from 'react'
import type { RouteObject } from 'react-router-dom'

const BillingPage = lazy(() => import('../../pages/billing/BillingPage'))

/** 设置：订阅与用量（admin / enterprise / auditor） */
export const settingsRoutes: RouteObject[] = [
  { path: 'billing', element: <BillingPage /> },
]
