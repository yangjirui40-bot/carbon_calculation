import { useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import './SwissRail.css'

export type SwissRailItem = {
  key: string
  label: string
  to: string
  disabled?: boolean
}

export type SwissRailGroup = {
  key: string
  label: string
  items: SwissRailItem[]
}

export type SwissRailProps = {
  /** 一层导航项（供应商门户等无分组场景） */
  items?: SwissRailItem[]
  /** 可折叠分组导航（主应用）；默认全部收起，点击分组标题展开 */
  groups?: SwissRailGroup[]
  /** 受控当前项；不传时按路由匹配 */
  activeKey?: string
}

/**
 * 左侧主导航：一层链接或可折叠分组。
 * 分组默认收起，标题为按钮，点击展开/收起；当前路由所在分组以强调色提示。
 */
export default function SwissRail({ items, groups, activeKey }: SwissRailProps) {
  const controlled = activeKey !== undefined
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  function toggleGroup(key: string) {
    setOpenGroups((current) => ({ ...current, [key]: !current[key] }))
  }

  function renderItems(list: SwissRailItem[]): ReactNode {
    return list.map((item) => {
      if (item.disabled) {
        return (
          <span
            key={item.key}
            className="swiss-rail__link swiss-rail__link--disabled"
            aria-disabled="true"
          >
            {item.label}
          </span>
        )
      }

      const current = item.key === activeKey
      return (
        <NavLink
          key={item.key}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) => {
            const active = controlled ? current : isActive
            return active ? 'swiss-rail__link is-active' : 'swiss-rail__link'
          }}
          {...(controlled ? { 'aria-current': current ? ('page' as const) : undefined } : {})}
        >
          {item.label}
        </NavLink>
      )
    })
  }

  return (
    <nav className="swiss-rail-nav" aria-label="主导航">
      {items ? renderItems(items) : null}

      {groups?.map((group) => {
        const expanded = Boolean(openGroups[group.key])
        const hasActive = group.items.some((item) => item.key === activeKey)
        const panelId = `swiss-rail-group-${group.key}`

        return (
          <div className="swiss-rail__group" key={group.key}>
            <button
              type="button"
              className={
                hasActive
                  ? 'swiss-rail__group-toggle has-active'
                  : 'swiss-rail__group-toggle'
              }
              aria-expanded={expanded}
              aria-controls={panelId}
              onClick={() => toggleGroup(group.key)}
            >
              <span className="swiss-rail__group-label">{group.label}</span>
              <span className="swiss-rail__group-caret" aria-hidden="true">
                {expanded ? '−' : '+'}
              </span>
            </button>
            <div
              id={panelId}
              className="swiss-rail__group-items"
              hidden={!expanded}
            >
              {renderItems(group.items)}
            </div>
          </div>
        )
      })}
    </nav>
  )
}
