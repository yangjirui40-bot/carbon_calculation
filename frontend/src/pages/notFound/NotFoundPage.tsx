import { Link } from 'react-router-dom'
import './NotFoundPage.css'

export default function NotFoundPage() {
  return (
    <div className="nf-swiss">
      <div className="nf-wrap">
        <header className="nf-masthead">
          <span className="nf-mark" aria-hidden="true" />
          <span className="nf-brand">碳速算</span>
          <span className="nf-brand-sub">Carbon Ledger</span>
        </header>

        <main className="nf-main">
          <div className="nf-code" aria-hidden="true">
            404
          </div>
          <h1>页面不存在</h1>
          <p>该地址没有对应的页面，可能是链接已更新或输入有误。</p>
          <div className="nf-actions">
            <Link className="nf-btn-primary" to="/workspace">
              返回工作台
            </Link>
            <Link className="nf-btn-ghost" to="/">
              返回首页
            </Link>
          </div>
        </main>

        <footer className="nf-foot">
          <span>碳速算 · 电子信息制造业碳核算平台</span>
          <span>Carbon Ledger</span>
        </footer>
      </div>
    </div>
  )
}
