import { lazy } from 'react'
import type { RouteObject } from 'react-router-dom'

const SupplyChainOverviewPage = lazy(
  () => import('../../pages/supply-chain/SupplyChainOverviewPage'),
)
const SuppliersPage = lazy(() => import('../../pages/supply-chain/SuppliersPage'))
const QuotasPage = lazy(() => import('../../pages/supply-chain/QuotasPage'))
const TradesPage = lazy(() => import('../../pages/supply-chain/TradesPage'))

/** 协同：供应链总览、供应商档案、配额与减排计划、配额交易与对账 */
const DisclosurePage = lazy(() => import('../../pages/disclosures/DisclosurePage'))

export const supplyChainRoutes: RouteObject[] = [
  { path: 'disclosures', element: <DisclosurePage /> },
  {
    path: 'supply-chain',
    element: <SupplyChainOverviewPage />,
  },
  {
    path: 'supply-chain/suppliers',
    element: <SuppliersPage />,
  },
  {
    path: 'supply-chain/quotas',
    element: <QuotasPage />,
  },
  {
    path: 'supply-chain/trades',
    element: <TradesPage />,
  },
]
