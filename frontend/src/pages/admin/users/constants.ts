import type { CreateUserPayload } from '../../../api/modules/auth'

export type UserRole = CreateUserPayload['role']

export const USER_ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: 'enterprise', label: '企业' },
  { value: 'supplier', label: '供应商' },
  { value: 'auditor', label: '审计员' },
  { value: 'admin', label: '管理员' },
]

const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: '管理员',
  enterprise: '企业',
  supplier: '供应商',
  auditor: '审计员',
}

export function userRoleLabel(role: UserRole): string {
  return USER_ROLE_LABELS[role]
}
