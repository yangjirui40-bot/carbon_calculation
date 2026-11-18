import { Link } from 'react-router-dom'
import LineIcon from '../../../components/common/LineIcon'
import './HomeHero.css'

type HomeHeroProps = {
  loggedIn: boolean
}

export default function HomeHero({ loggedIn }: HomeHeroProps) {
  const primaryTo = loggedIn ? '/workspace' : '/login'
  const primaryLabel = loggedIn ? '进入工作台' : '登录'

  return (
    <section className="home-hero">
      <div>
        <div className="home-kicker">Carbon accounting</div>
        <h1>
          把票据，
          <br />
          变成可追溯的
          <br />
          <em>Scope 结果。</em>
        </h1>
        <p className="home-lead">
          上传票据、核对字段、按 Scope 汇总，并在驾驶舱查看排放结构、流向与趋势。
          每一步都有据可查，最后得到一份可打印的核算报告。
        </p>
        <div className="home-actions">
          <Link className="home-btn-primary" to={primaryTo}>
            {primaryLabel} <LineIcon name="arrow-up-right" size={15} />
          </Link>
          <Link className="home-btn-ghost" to="/register">
            企业注册
          </Link>
        </div>
      </div>

      <aside className="home-diagram" aria-label="票据、字段、图表的流程示意">
        <div className="home-panel">
          <div className="home-panel-label">
            <span>01 / DOC</span>
            <LineIcon name="file-text" size={14} />
          </div>
          <h2>票据</h2>
          <div className="home-doc-lines" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <div className="home-doc-box" aria-hidden="true" />
          <div className="home-panel-foot">图片 / PDF</div>
        </div>

        <div className="home-panel">
          <div className="home-panel-label">
            <span>02 / FIELD</span>
            <LineIcon name="scan" size={14} />
          </div>
          <h2>字段</h2>
          <div className="home-field-rows">
            <div className="home-field-row">
              <span>供应商</span>
              <b>已识别</b>
            </div>
            <div className="home-field-row">
              <span>未税金额</span>
              <b>已识别</b>
            </div>
            <div className="home-field-row">
              <span>税额</span>
              <b>需核对</b>
            </div>
            <div className="home-field-row">
              <span>日期</span>
              <b>已识别</b>
            </div>
          </div>
          <div className="home-panel-foot">逐字段确认</div>
        </div>

        <div className="home-panel">
          <div className="home-panel-label">
            <span>03 / RESULT</span>
            <LineIcon name="pie" size={14} />
          </div>
          <h2>结果</h2>
          <div className="home-bars" aria-hidden="true">
            <i style={{ height: '38%' }} />
            <i style={{ height: '64%' }} />
            <i style={{ height: '86%' }} />
          </div>
          <div className="home-panel-foot">Scope 1 / 2 / 3</div>
        </div>
      </aside>
    </section>
  )
}
