/**
 * 全站导航配置（front_plan/15 §3）：
 * NAV_GROUPS 是主导航的唯一来源，按角色过滤后交给 SwissRail。
 * 带参数的结果页、报告详情不进入导航，导航只放稳定入口。
 */
import { isRoleAllowed, type Role } from './roles'

/** 全量导航项；key 仅在导航内部唯一，to 为稳定入口 */
export type NavLinkItem = {
  key: string
  label: string
  to: string
  /** 为空表示所有可进入主应用的角色可见 */
  roles?: Role[]
}

export type NavGroup = {
  title: string
  items: NavLinkItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: '总览',
    items: [
      { key: 'workspace', label: '工作台', to: '/workspace' },
      { key: 'dashboard', label: '驾驶舱', to: '/dashboard' },
    ],
  },
  {
    title: '数据',
    items: [
      { key: 'documents', label: '单据管理', to: '/documents' },
      { key: 'records', label: '业务记录', to: '/records' },
      { key: 'factors', label: '因子库', to: '/factors' },
    ],
  },
  {
    title: '核算',
    items: [
      { key: 'calculations', label: '核算中心', to: '/calculations' },
      { key: 'eiolca', label: 'EIO-LCA', to: '/calculations/eiolca' },
      { key: 'products', label: '产品碳足迹', to: '/products' },
    ],
  },
  {
    title: '报告',
    items: [{ key: 'reports', label: '报告中心', to: '/reports' }],
  },
  {
    title: '分析',
    items: [{ key: 'simulator', label: '减排模拟', to: '/simulator' }],
  },
  {
    title: '协同',
    items: [
      { key: 'supply-chain', label: '供应链总览', to: '/supply-chain' },
      { key: 'supply-chain-suppliers', label: '供应商', to: '/supply-chain/suppliers' },
      { key: 'supply-chain-quotas', label: '配额', to: '/supply-chain/quotas' },
      { key: 'supply-chain-trades', label: '交易', to: '/supply-chain/trades' },
    ],
  },
  {
    title: '审计',
    items: [{ key: 'audit', label: '审计日志', to: '/audit' }],
  },
  {
    title: '设置',
    items: [{ key: 'billing', label: '订阅用量', to: '/billing' }],
  },
  {
    title: '管理后台',
    items: [
      { key: 'admin-companies', label: '企业管理', to: '/admin/companies', roles: ['admin'] },
      { key: 'admin-users', label: '账号开通', to: '/admin/users', roles: ['admin'] },
      { key: 'system', label: '系统运维', to: '/system', roles: ['admin'] },
    ],
  },
]

/**
 * 按角色过滤导航分组：
 * admin 全部；enterprise / auditor 不含管理后台；supplier 走独立壳层，不显示主应用导航。
 */
export function filterNavGroups(role: Role | null): NavGroup[] {
  if (!role || role === 'supplier') return []
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.roles || isRoleAllowed(role, item.roles)),
  })).filter((group) => group.items.length > 0)
}

/** 取路径第一段做高亮匹配，例如 /documents/x/review → documents */
export function getActiveSegment(pathname: string): string {
  return pathname.split('/')[1] ?? ''
}

/* ------------------------------------------------------------------
 * 以下为中期 AppLayout 的旧菜单，仅供 layouts/AppLayout/AppSider 使用。
 * 新壳层统一读取 NAV_GROUPS；待 AppLayout 下线后整段删除。
 * ------------------------------------------------------------------ */

export type NavItem = {
  segment: string
  label: string
  to: string | null
  disabledReason?: string
}

const NO_RUN_REASON = '还没有核算记录'

export const NAV_ITEMS: NavItem[] = [
  { segment: 'workspace', label: '工作台', to: '/workspace' },
  { segment: 'documents', label: '单据管理', to: '/documents' },
  { segment: 'results', label: '核算结果', to: null, disabledReason: NO_RUN_REASON },
  { segment: 'reports', label: '报告', to: null, disabledReason: NO_RUN_REASON },
]
