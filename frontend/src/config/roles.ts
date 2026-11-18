/**
 * 前端角色定义，与后端 app/deps.py 保持一致：
 * admin / enterprise / auditor / supplier。
 */
export type Role = 'admin' | 'enterprise' | 'auditor' | 'supplier'

export const ROLE_LABELS: Record<Role, string> = {
  admin: '管理员',
  enterprise: '企业用户',
  auditor: '审计员',
  supplier: '供应商',
}

const ROLES: readonly Role[] = ['admin', 'enterprise', 'auditor', 'supplier']

/** 会话解析时的角色校验，非法值视为未登录 */
export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

/** 当前角色是否在允许列表中 */
export function isRoleAllowed(role: Role, allowed: readonly Role[]): boolean {
  return allowed.includes(role)
}
