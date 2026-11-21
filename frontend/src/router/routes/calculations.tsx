import { lazy } from 'react'
import type { RouteObject } from 'react-router-dom'

const CalculationsPage = lazy(() => import('../../pages/calculations/CalculationsPage'))
const EiolcaPage = lazy(() => import('../../pages/calculations/EiolcaPage'))
const InventoryPage = lazy(() => import('../../pages/inventory/InventoryPage'))
const ResultsPage = lazy(() => import('../../pages/results/ResultsPage'))

/** 核算：核算中心、EIO-LCA 核算台、核算结果 */
export const calculationRoutes: RouteObject[] = [
  { path: 'inventory', element: <InventoryPage /> },
  { path: 'calculations', element: <CalculationsPage /> },
  { path: 'calculations/eiolca', element: <EiolcaPage /> },
  { path: 'results/:runId', element: <ResultsPage /> },
]
