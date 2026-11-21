import { lazy } from 'react'
import type { RouteObject } from 'react-router-dom'

const WorkspacePage = lazy(() => import('../../pages/workspace/WorkspacePage'))
const DashboardPage = lazy(() => import('../../pages/dashboard/DashboardPage'))

/** 总览：工作台、碳排全景驾驶舱 */
const OrganizationPage = lazy(() => import('../../pages/organization/OrganizationPage'))

export const overviewRoutes: RouteObject[] = [
  { path: 'organization', element: <OrganizationPage /> },
  { path: 'workspace', element: <WorkspacePage /> },
  { path: 'dashboard', element: <DashboardPage /> },
]
