import { Button } from 'antd'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import SwissAppShell from '../layouts/SwissAppLayout/SwissAppShell'
import SwissRail from '../layouts/SwissAppLayout/SwissRail'
import { clearSession, readSession } from './guards/RequireAuth'

const SUPPLIER_NAV = [
  { key: 'supplier', label: '门户首页', to: '/supplier' },
  { key: 'supplier-report', label: '碳数据填报', to: '/supplier/report' },
  { key: 'supplier-submissions', label: '上报历史', to: '/supplier/submissions' },
]

/** 供应商门户内部按完整路径高亮，避免三个页面共用 supplier 首段 */
function getSupplierActiveKey(pathname: string): string {
  if (pathname.startsWith('/supplier/report')) return 'supplier-report'
  if (pathname.startsWith('/supplier/submissions')) return 'supplier-submissions'
  return 'supplier'
}

/** 供应商壳层：窄版顶部账号区 + 三项导航 + 页面出口 */
export default function SupplierLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const session = readSession()

  // RequireAuth 已拦截未登录；这里只防御退出瞬间的过渡渲染
  if (!session) return null

  const activeKey = getSupplierActiveKey(pathname)

  const handleLogout = () => {
    clearSession()
    navigate('/login', { replace: true })
  }

  return (
    <SwissAppShell
      activeKey={activeKey}
      rail={<SwissRail items={SUPPLIER_NAV} activeKey={activeKey} />}
      headerRight={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>{session.user.username}</span>
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
