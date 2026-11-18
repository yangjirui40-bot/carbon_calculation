import { Layout, Menu, Tooltip } from 'antd'
import type { MenuProps } from 'antd'
import { useLocation, useNavigate } from 'react-router-dom'
import { SIDER_WIDTH } from '../../config/layout'
import { getActiveSegment, NAV_ITEMS, type NavItem } from '../../config/navigation'
import './AppSider.css'

/**
 * 需要 runId 的菜单项在没有目标地址时置灰；
 * 但用户已经停在该页（地址里有 runId）时保持可用，否则会高亮一个灰掉的菜单项。
 */
function isDisabled(item: NavItem, activeSegment: string): boolean {
  return item.to === null && item.segment !== activeSegment
}

/** 左侧 4 项菜单；高亮按路径第一段匹配（00 §3） */
export default function AppSider() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const activeSegment = getActiveSegment(pathname)

  const items: MenuProps['items'] = NAV_ITEMS.map((item) => ({
    key: item.segment,
    disabled: isDisabled(item, activeSegment),
    label:
      item.to === null && item.disabledReason ? (
        <Tooltip title={item.disabledReason} placement="right">
          <span>{item.label}</span>
        </Tooltip>
      ) : (
        item.label
      ),
  }))

  const handleClick: MenuProps['onClick'] = ({ key }) => {
    const target = NAV_ITEMS.find((item) => item.segment === key)?.to
    if (target) navigate(target)
  }

  return (
    <Layout.Sider className="app-sider" width={SIDER_WIDTH} theme="light">
      <nav aria-label="主导航">
        <Menu
          mode="inline"
          items={items}
          selectedKeys={[activeSegment]}
          onClick={handleClick}
        />
      </nav>
    </Layout.Sider>
  )
}
