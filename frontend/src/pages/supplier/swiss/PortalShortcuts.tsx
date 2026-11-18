import { Link } from 'react-router-dom'
import './PortalShortcuts.css'

const SHORTCUTS = [
  {
    index: '01',
    to: '/supplier/report',
    title: '去碳数据填报',
    description: '按期间提交排放量与排放强度，提交后自动扣减当年配额。',
  },
  {
    index: '02',
    to: '/supplier/submissions',
    title: '查看上报历史',
    description: '浏览历次上报记录，查看上报排放量随期间的变化。',
  },
]

/** 首页快捷入口：两个大号细线链接块 */
export default function PortalShortcuts() {
  return (
    <nav className="supplier-shortcuts" aria-label="快捷入口">
      {SHORTCUTS.map((item) => (
        <Link key={item.to} className="supplier-shortcut" to={item.to}>
          <span className="supplier-shortcut__index num">{item.index}</span>
          <span className="supplier-shortcut__body">
            <span className="supplier-shortcut__title">{item.title}</span>
            <span className="supplier-shortcut__desc">{item.description}</span>
          </span>
          <span className="supplier-shortcut__arrow" aria-hidden="true">
            →
          </span>
        </Link>
      ))}
    </nav>
  )
}
