import type { RouteObject } from 'react-router-dom'
import { lazy } from 'react'
const SupplierDisclosurePage = lazy(() => import('../../pages/disclosures/DisclosurePage').then((module) => ({default:module.SupplierDisclosurePage})))
import SupplierHomePage from '../../pages/supplier/SupplierHomePage'
import SupplierReportPage from '../../pages/supplier/SupplierReportPage'
import SupplierSubmissionsPage from '../../pages/supplier/SupplierSubmissionsPage'

/** 供应商门户：门户首页、碳数据填报、上报历史 */
export const supplierRoutes: RouteObject[] = [
  { path: 'supplier/disclosures', element: <SupplierDisclosurePage /> },
  {
    path: 'supplier',
    element: <SupplierHomePage />,
  },
  {
    path: 'supplier/report',
    element: <SupplierReportPage />,
  },
  {
    path: 'supplier/submissions',
    element: <SupplierSubmissionsPage />,
  },
]
