import type { RouteObject } from 'react-router-dom'
import SupplierHomePage from '../../pages/supplier/SupplierHomePage'
import SupplierReportPage from '../../pages/supplier/SupplierReportPage'
import SupplierSubmissionsPage from '../../pages/supplier/SupplierSubmissionsPage'

/** 供应商门户：门户首页、碳数据填报、上报历史 */
export const supplierRoutes: RouteObject[] = [
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
