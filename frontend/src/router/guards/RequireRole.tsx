import { Navigate, Outlet } from 'react-router-dom'
import { isRoleAllowed, type Role } from '../../config/roles'
import { readSession } from './RequireAuth'

type RequireRoleProps = {
  roles: readonly Role[]
}

/**
 * 角色守卫，必须挂在 RequireAuth 之内：
 * supplier 越权回 /supplier，其他角色越权回 /workspace。
 */
export default function RequireRole({ roles }: RequireRoleProps) {
  const role = readSession()?.user.role

  if (!role || !isRoleAllowed(role, roles)) {
    return <Navigate to={role === 'supplier' ? '/supplier' : '/workspace'} replace />
  }

  return <Outlet />
}
