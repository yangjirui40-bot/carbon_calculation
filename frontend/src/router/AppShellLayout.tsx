import { Button } from 'antd'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { filterNavGroups, getActiveSegment } from '../config/navigation'
import { ROLE_LABELS } from '../config/roles'
import SwissAppShell from '../layouts/SwissAppLayout/SwissAppShell'
import SwissRail, { type SwissRailGroup } from '../layouts/SwissAppLayout/SwissRail'
import { clearSession, readSession } from './guards/RequireAuth'

/** 主应用壳层：账号区 + 按角色过滤的分组导航 + 页面出口 */
export default function AppShellLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const session = readSession()

  // RequireAuth 已拦截未登录；这里只防御退出瞬间的过渡渲染
  if (!session) return null

  const activeKey = getActiveSegment(pathname)

  // 分组导航：默认收起，标题点击展开；角色过滤沿用 navigation.ts
  const railGroups: SwissRailGroup[] = filterNavGroups(session.user.role).map((group) => ({
    key: group.title,
    label: group.title,
    items: group.items.map((item) => ({ key: item.key, label: item.label, to: item.to })),
  }))

  const handleLogout = () => {
    clearSession()
    navigate('/login', { replace: true })
  }

  return (
    <SwissAppShell
      activeKey={activeKey}
      rail={<SwissRail groups={railGroups} activeKey={activeKey} />}
      headerRight={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>{session.user.username}</span>
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>
            {ROLE_LABELS[session.user.role]}
          </span>
          <Button size="small" onClick={handleLogout}>
            退出
          </Button>
        </div>
      }
    >
      <Outlet />
    </SwissAppShell>
  )
}
