import { NavLink } from 'react-router-dom'
import './shared.css'

const ITEMS = [
  { to: '/supply-chain', label: '总览', end: true },
  { to: '/supply-chain/suppliers', label: '供应商档案', end: false },
  { to: '/supply-chain/quotas', label: '配额与减排计划', end: false },
  { to: '/supply-chain/trades', label: '配额交易与对账', end: false },
]

/** 供应链四个子页之间的页内跳转 */
export default function SupplyChainSubnav() {
  return (
    <nav className="sc-subnav" aria-label="供应链子页">
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            isActive ? 'sc-subnav__link is-active' : 'sc-subnav__link'
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
