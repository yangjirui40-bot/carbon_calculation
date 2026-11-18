import { lazy } from 'react'
import type { RouteObject } from 'react-router-dom'

const DocumentsPage = lazy(() => import('../../pages/documents/DocumentsPage'))
const ReviewPage = lazy(() => import('../../pages/review/ReviewPage'))
const RecordsPage = lazy(() => import('../../pages/records/RecordsPage'))
const FactorsPage = lazy(() => import('../../pages/factors/FactorsPage'))

/** 数据：单据管理、数据核对、业务记录、排放因子库 */
export const dataRoutes: RouteObject[] = [
  { path: 'documents', element: <DocumentsPage /> },
  { path: 'documents/:id/review', element: <ReviewPage /> },
  { path: 'records', element: <RecordsPage /> },
  { path: 'factors', element: <FactorsPage /> },
]
