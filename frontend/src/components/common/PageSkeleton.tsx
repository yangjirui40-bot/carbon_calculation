import { Skeleton } from 'antd'
import './PageSkeleton.css'

/** 路由懒加载时的页面骨架，避免空白等待 */
export default function PageSkeleton() {
  return (
    <div className="page-skeleton" aria-label="页面加载中" aria-busy="true">
      <Skeleton active title={{ width: '30%' }} paragraph={{ rows: 2 }} />
      <Skeleton active paragraph={{ rows: 6 }} />
    </div>
  )
}
