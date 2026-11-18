import { readSession } from '../../router/guards/RequireAuth'
import { useCompanyScope } from '../calculations/useCompanyScope'

/**
 * 供应链四页共用的企业解析：
 * - 企业账号固定用会话里的 company_id；
 * - admin / auditor 用全局公司上下文，未选时由页面经 companiesApi 加载列表供选择。
 * 复用核算中心 useCompanyScope 的同一套规则，避免两处口径漂移。
 */
export function useSupplyChainCompany() {
  const scope = useCompanyScope()
  const role = readSession()?.user.role ?? null

  return {
    ...scope,
    role,
    canWrite: role === 'admin' || role === 'enterprise',
    /** 企业账号未绑定企业：无法查询任何供应链数据 */
    unbound: role === 'enterprise' && scope.effectiveCompanyId === null,
  }
}
