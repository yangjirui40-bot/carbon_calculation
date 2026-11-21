import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  AppstoreOutlined, AuditOutlined, BarChartOutlined, BarsOutlined, CalculatorOutlined,
  FileDoneOutlined, FileTextOutlined, FundOutlined, GoldOutlined, HddOutlined,
  InteractionOutlined, ProfileOutlined, SettingOutlined, TeamOutlined, ThunderboltOutlined,
} from '@ant-design/icons'
import './SwissRail.css'

export type SwissRailItem = { key: string; label: string; to: string; disabled?: boolean }
export type SwissRailGroup = { key: string; label: string; items: SwissRailItem[] }

const icons = {
  workspace: AppstoreOutlined,
  dashboard: BarChartOutlined,
  documents: FileTextOutlined,
  records: ProfileOutlined,
  factors: HddOutlined,
  calculations: CalculatorOutlined,
  eiolca: FundOutlined,
  products: GoldOutlined,
  reports: FileDoneOutlined,
  simulator: ThunderboltOutlined,
  'supply-chain': InteractionOutlined,
  'supply-chain-suppliers': TeamOutlined,
  audit: AuditOutlined,
}

export type SwissRailProps = {
  items?: SwissRailItem[]
  groups?: SwissRailGroup[]
  activeKey?: string
}

export default function SwissRail({ items, groups, activeKey }: SwissRailProps) {
  const [open, setOpen] = useState(false)

  function renderItems(list: SwissRailItem[]) {
    return list.map((item) => {
      const Icon = icons[item.key as keyof typeof icons] ?? SettingOutlined
      if (item.disabled) {
        return <span key={item.key} className="swiss-rail__link" aria-disabled="true"><Icon />{item.label}</span>
      }
      return (
        <NavLink
          key={item.key}
          onClick={() => setOpen(false)}
          to={item.to}
          className={({ isActive }) =>
            (activeKey === undefined ? isActive : activeKey === item.key) ? 'swiss-rail__link is-active' : 'swiss-rail__link'
          }
        >
          <Icon aria-hidden="true" />
          {item.label}
        </NavLink>
      )
    })
  }

  return (
    <nav className="swiss-rail-nav" aria-label="主导航">
      <button className="swiss-rail__mobile-toggle" type="button" aria-expanded={open}
        aria-controls="carbon-navigation" onClick={() => setOpen(!open)}>
        <BarsOutlined /> 模块导航
        <span>{open ? '收起' : '展开'}</span>
      </button>
      <div id="carbon-navigation" className="swiss-rail__navigation-items" data-open={open}>
        {items && renderItems(items)}
        {groups?.map((group) => (
          <div className="swiss-rail__group" key={group.key}>
            <div className="swiss-rail__group-label">{group.label}</div>
            {renderItems(group.items)}
          </div>
        ))}
      </div>
    </nav>
  )
}
