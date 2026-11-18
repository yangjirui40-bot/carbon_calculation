import type { RouteObject } from 'react-router-dom'
import { analysisRoutes } from './analysis'
import { auditRoutes } from './audit'
import { calculationRoutes } from './calculations'
import { dataRoutes } from './data'
import { overviewRoutes } from './overview'
import { productRoutes } from './products'
import { reportRoutes } from './reports'
import { settingsRoutes } from './settings'
import { supplyChainRoutes } from './supplyChain'

export { publicRoutes } from './public'
export { adminRoutes } from './admin'
export { supplierRoutes } from './supplier'

/** 主应用（企业/管理/审计）业务路由，挂在 AppShellLayout 下 */
export const mainAppRoutes: RouteObject[] = [
  ...overviewRoutes,
  ...dataRoutes,
  ...calculationRoutes,
  ...productRoutes,
  ...reportRoutes,
  ...analysisRoutes,
  ...supplyChainRoutes,
  ...auditRoutes,
  ...settingsRoutes,
]
