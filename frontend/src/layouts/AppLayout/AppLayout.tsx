import { Layout } from 'antd'
import { Outlet } from 'react-router-dom'
import AppFooter from './AppFooter'
import AppHeader from './AppHeader'
import AppSider from './AppSider'
import './AppLayout.css'

/**
 * 外壳只负责拼装：顶部栏 / 侧栏 / 内容区 / 页脚（01 §1）。
 * <Outlet /> 是子路由页面渲染的位置。
 */
export default function AppLayout() {
  return (
    <Layout className="app-layout">
      <AppHeader />
      <Layout>
        <AppSider />
        <Layout.Content className="app-layout__content">
          <Outlet />
        </Layout.Content>
      </Layout>
      <AppFooter />
    </Layout>
  )
}
