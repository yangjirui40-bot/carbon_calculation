import { lazy } from 'react'
import type { RouteObject } from 'react-router-dom'

const DocumentsPage = lazy(() => import('../../pages/documents/DocumentsPage'))
const FactoryPage = lazy(() => import('../../pages/controls/FactoryPage'))
const EnergyPage = lazy(() => import('../../pages/controls/EnergyPage'))
const JournalPage = lazy(() => import('../../pages/controls/JournalPage'))
const ReviewPage = lazy(() => import('../../pages/review/ReviewPage'))
const RecordsPage = lazy(() => import('../../pages/records/RecordsPage'))
const IntegrationsPage = lazy(() => import('../../pages/integrations/IntegrationsPage'))
const CompanyFactorsPage = lazy(() => import('../../pages/company-factors/CompanyFactorsPage'))
const FactorsPage = lazy(() => import('../../pages/factors/FactorsPage'))

/** 数据：单据管理、数据核对、业务记录、排放因子库 */
export const dataRoutes: RouteObject[] = [
  { path: 'factory', element: <FactoryPage /> },
  { path: 'energy', element: <EnergyPage /> },
  { path: 'journals', element: <JournalPage /> },
  { path: 'documents', element: <DocumentsPage /> },
  { path: 'documents/:id/review', element: <ReviewPage /> },
  { path: 'records', element: <RecordsPage /> },
  { path: 'integrations', element: <IntegrationsPage /> },
  { path: 'company-factors', element: <CompanyFactorsPage /> },
  { path: 'factors', element: <FactorsPage /> },
]
