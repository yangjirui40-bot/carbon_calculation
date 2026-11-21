import type { ReactNode } from 'react'
import { ApartmentOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import '../../styles/swiss-tokens.css'
import './SwissAppShell.css'

export type SwissAppShellProps = {
  activeKey?: string
  rail?: ReactNode
  headerRight?: ReactNode
  children: ReactNode
}

export default function SwissAppShell({ activeKey, rail, headerRight, children }: SwissAppShellProps) {
  return (
    <div className="swiss-app" data-active-key={activeKey}>
      <header className="swiss-app__header">
        <Link className="swiss-app__brand" to="/">
          <span className="carbon-mark" aria-hidden="true"><ApartmentOutlined /></span>
          <span className="swiss-app__brand-name">碳速算</span>
          <span className="swiss-app__brand-sub">企业碳管理</span>
        </Link>
        <div className="swiss-app__header-right">{headerRight}</div>
      </header>
      <div className={rail ? 'swiss-app__body' : 'swiss-app__body swiss-app__body--no-rail'}>
        {rail ? <aside className="swiss-app__rail">{rail}</aside> : null}
        <div className="swiss-app__content">
          {children}
        </div>
      </div>
    </div>
  )
}
