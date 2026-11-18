import { readSession } from '../../router/guards/RequireAuth'
import HomeCapability from './swiss/HomeCapability'
import HomeHero from './swiss/HomeHero'
import HomeMasthead from './swiss/HomeMasthead'
import HomeProcess from './swiss/HomeProcess'
import './HomePage.css'

/** 首页采用独立的瑞士风格外壳，与工作台同一套配色与排版语言 */
export default function HomePage() {
  const loggedIn = readSession() !== null

  return (
    <div className="home-swiss">
      <div className="home-wrap">
        <HomeMasthead />
        <main>
          <HomeHero loggedIn={loggedIn} />
          <HomeProcess />
          <HomeCapability />
        </main>
        <footer className="home-foot">
          <span>碳速算 · 电子信息制造业碳核算平台</span>
          <span>Carbon Ledger</span>
        </footer>
      </div>
    </div>
  )
}
