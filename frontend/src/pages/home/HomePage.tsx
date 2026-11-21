import { ApartmentOutlined, ArrowRightOutlined, AuditOutlined, BarChartOutlined, CalculatorOutlined, FileSearchOutlined, GoldOutlined, TeamOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { readSession } from '../../router/guards/RequireAuth'
import '../../styles/swiss-tokens.css'
import './HomePage.css'

const modules = [
  { name: '智能数据解析', detail: '连接 ERP、批量导入台账或上传票据，逐项核对后参与核算。', icon: FileSearchOutlined, path: '/documents' },
  { name: '产品碳足迹', detail: '管理 BOM 和因子版本，加入生产分摊，生成有参考期的产品足迹。', icon: GoldOutlined, path: '/products' },
  { name: '排放驾驶舱', detail: '按核算快照查看工厂、车间与产线流向，追踪范围覆盖与月度趋势。', icon: BarChartOutlined, path: '/dashboard' },
  { name: '核算审计', detail: '提交盘查、异岗复核关账；按报告版本追溯因子和原件。', icon: AuditOutlined, path: '/audit' },
  { name: '减排情景', detail: '锁定基线，比较节电与采购调减方案，测算投资回报。', icon: ThunderboltOutlined, path: '/simulator' },
  { name: '供应链协同', detail: '下发定向披露任务，核对供应商反馈和退回版本，跟踪缺报与配额。', icon: TeamOutlined, path: '/supply-chain' },
]

export default function HomePage() {
  const user = readSession()?.user
  const target = user ? (user.role === 'supplier' ? '/supplier' : '/workspace') : '/login'
  return (
    <div className="carbon-home">
      <header className="carbon-home__header">
        <div className="carbon-home__frame">
          <Link to="/" className="carbon-home__brand"><span><ApartmentOutlined /></span> 碳速算</Link>
          <nav aria-label="网站导航">
            <a href="#product">平台能力</a>
            <Link to={target}>{user ? '进入平台' : '登录'}</Link>
          </nav>
        </div>
      </header>
      <main>
        <section className="carbon-home__hero">
          <div className="carbon-home__frame carbon-home__hero-content">
            <div>
              <p className="carbon-home__audience">电子信息制造业</p>
              <h1>企业碳核算<br />与供应链管理</h1>
              <p className="carbon-home__lead">从采购、能耗凭证到企业盘查和产品碳足迹。让每一笔排放都能回到对应的业务记录与因子版本。</p>
              <div className="carbon-home__actions">
                <Link className="home-cta" to={target}>{user ? '打开工作台' : '登录工作台'} <ArrowRightOutlined /></Link>
                {!user && <Link className="home-cta is-ghost" to="/register">注册企业</Link>}
              </div>
            </div>
            <div className="carbon-home__trace">
              <p>从原始凭证到核算报告</p>
              <div className="carbon-home__trace-row"><span><FileSearchOutlined /></span><div><b>采集与复核</b><small>图片、PDF、Excel 台账</small></div></div>
              <div className="carbon-home__trace-row"><span><CalculatorOutlined /></span><div><b>范围 1 / 2 / 3 核算</b><small>活动量与排放因子版本</small></div></div>
              <div className="carbon-home__trace-row"><span><AuditOutlined /></span><div><b>证据与报告</b><small>快照、原件、计算记录</small></div></div>
            </div>
          </div>
        </section>
        <section className="carbon-home__frame carbon-home__modules" id="product">
          <h2>平台能力</h2>
          <div className="carbon-home__module-grid">
            {modules.map(({ name, detail, icon: Icon, path }) => (
              <Link key={path} to={user?.role === 'supplier' ? '/supplier' : path}>
                <span className="carbon-home__module-icon"><Icon /></span>
                <div><h3>{name}</h3><p>{detail}</p></div>
                <ArrowRightOutlined className="carbon-home__arrow" />
              </Link>
            ))}
          </div>
        </section>
      </main>
      <footer className="carbon-home__foot"><div className="carbon-home__frame">碳速算 · 企业碳管理平台</div></footer>
    </div>
  )
}
