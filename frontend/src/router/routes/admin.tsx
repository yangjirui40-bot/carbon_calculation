import { lazy } from 'react'
import type { RouteObject } from 'react-router-dom'

const AdminCompaniesPage = lazy(() => import('../../pages/admin/companies/AdminCompaniesPage'))
const AdminUsersPage = lazy(() => import('../../pages/admin/users/AdminUsersPage'))
const SystemPage = lazy(() => import('../../pages/system/SystemPage'))

/** 管理后台：仅管理员可进入（由 AppRouter 的角色守卫包裹） */
export const adminRoutes: RouteObject[] = [
  { path: 'admin/companies', element: <AdminCompaniesPage /> },
  { path: 'admin/users', element: <AdminUsersPage /> },
  { path: 'system', element: <SystemPage /> },
]
