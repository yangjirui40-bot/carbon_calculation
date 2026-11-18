import { Suspense } from 'react'
import { BrowserRouter, useRoutes, type RouteObject } from 'react-router-dom'
import ErrorBoundary from '../components/common/ErrorBoundary'
import PageSkeleton from '../components/common/PageSkeleton'
import CompanyProvider from '../context/CompanyContext'
import AppShellLayout from './AppShellLayout'
import RequireAuth from './guards/RequireAuth'
import RequireRole from './guards/RequireRole'
import { adminRoutes, mainAppRoutes, publicRoutes, supplierRoutes } from './routes'
import SupplierLayout from './SupplierLayout'

const MAIN_APP_ROLES = ['admin', 'enterprise', 'auditor'] as const

/**
 * 路由树（front_plan/15 §2、§4）：
 * 公开入口 → RequireAuth → RequireRole → 对应壳层 → 页面。
 * 所有页面用 React.lazy 做路由级拆分，占位页静态引入。
 */
const routes: RouteObject[] = [
  ...publicRoutes,
  {
    element: <RequireAuth />,
    children: [
      {
        element: <RequireRole roles={['admin']} />,
        children: [{ element: <AppShellLayout />, children: adminRoutes }],
      },
      {
        element: <RequireRole roles={MAIN_APP_ROLES} />,
        children: [{ element: <AppShellLayout />, children: mainAppRoutes }],
      },
      {
        element: <RequireRole roles={['supplier']} />,
        children: [{ element: <SupplierLayout />, children: supplierRoutes }],
      },
    ],
  },
]

function AppRoutes() {
  return useRoutes(routes)
}

export default function AppRouter() {
  return (
    <CompanyProvider>
      <BrowserRouter>
        <ErrorBoundary>
          <Suspense fallback={<PageSkeleton />}>
            <AppRoutes />
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </CompanyProvider>
  )
}
