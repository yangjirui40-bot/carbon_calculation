import { lazy } from 'react'
import type { RouteObject } from 'react-router-dom'

const SimulatorPage = lazy(() => import('../../pages/simulator/SimulatorPage'))

/** 分析：减排路径模拟器 */
export const analysisRoutes: RouteObject[] = [
  { path: 'simulator', element: <SimulatorPage /> },
]
