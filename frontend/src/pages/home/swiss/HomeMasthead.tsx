import './HomeMasthead.css'

export default function HomeMasthead() {
  return (
    <header className="home-masthead">
      <div className="home-brand">
        <span className="home-brand-mark" aria-hidden="true" />
        <div>
          <div className="home-brand-name">碳速算</div>
          <div className="home-brand-sub">Carbon Ledger</div>
        </div>
      </div>
      <div className="home-mast-meta">电子信息制造业 · 碳核算</div>
    </header>
  )
}
