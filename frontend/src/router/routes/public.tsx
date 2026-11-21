import { lazy } from 'react'
import type { RouteObject } from 'react-router-dom'

const HomePage = lazy(() => import('../../pages/home/HomePage'))
const LoginPage = lazy(() => import('../../pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('../../pages/auth/RegisterPage'))
const JoinInvitePage = lazy(() => import('../../pages/auth/JoinInvitePage'))
const NotFoundPage = lazy(() => import('../../pages/notFound/NotFoundPage'))

/** 公开入口：首页、登录、注册、404 */
export const publicRoutes: RouteObject[] = [
  { path: '/', element: <HomePage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/join', element: <JoinInvitePage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '*', element: <NotFoundPage /> },
]
