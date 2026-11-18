import { lazy } from 'react'
import type { RouteObject } from 'react-router-dom'

const AuditLogPage = lazy(() => import('../../pages/audit/AuditLogPage'))
const AuditRunPage = lazy(() => import('../../pages/audit/AuditRunPage'))

/** 审计：审计日志、核算穿透与存证 */
export const auditRoutes: RouteObject[] = [
  { path: 'audit', element: <AuditLogPage /> },
  { path: 'audit/runs/:runId', element: <AuditRunPage /> },
]
