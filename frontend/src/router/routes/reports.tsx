import { lazy } from 'react'
import type { RouteObject } from 'react-router-dom'

const ReportCenterPage = lazy(() => import('../../pages/report/ReportCenterPage'))
const ReportPage = lazy(() => import('../../pages/report/ReportPage'))

/** 报告：报告中心、报告详情（:reportNo） */
export const reportRoutes: RouteObject[] = [
  { path: 'reports', element: <ReportCenterPage /> },
  { path: 'reports/:reportNo', element: <ReportPage /> },
]
