import type { ReactNode } from 'react'
import '../../styles/swiss-tokens.css'
import './SwissAppShell.css'

export type SwissAppShellProps = {
  /** 当前模块标识，仅作为根节点 data-active-key 暴露，壳层不自行推导 */
  activeKey?: string
  /** 左侧导航槽位，传入 <SwissRail /> 或分组后的自定义导航；为空不渲染侧栏 */
  rail?: ReactNode
  /** 顶部栏右侧内容（企业、角色、帮助等） */
  headerRight?: ReactNode
  children: ReactNode
}

/**
 * 主应用壳层：顶部栏 + 左侧栏槽位 + 内容区 + 页脚。
 * 不依赖 react-router，导航由调用方通过 rail / headerRight 注入。
 */
export default function SwissAppShell({
  activeKey,
  rail,
  headerRight,
  children,
}: SwissAppShellProps) {
  return (
    <div className="swiss-app" data-active-key={activeKey}>
      <header className="swiss-app__header">
        <div className="swiss-app__brand">
          <span className="swiss-app__brand-name">碳速算</span>
          <span className="swiss-app__brand-sub">/ Carbon Ledger</span>
        </div>
        <div className="swiss-app__header-right">{headerRight}</div>
      </header>

      <div className={rail ? 'swiss-app__body' : 'swiss-app__body swiss-app__body--no-rail'}>
        {rail ? <aside className="swiss-app__rail">{rail}</aside> : null}
        <main className="swiss-app__content">{children}</main>
      </div>

      <footer className="swiss-app__footer">
        <span>碳速算 · 电子信息制造业碳核算平台</span>
        <span>Carbon Ledger</span>
      </footer>
    </div>
  )
}
