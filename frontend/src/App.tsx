import { App as AntdApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { appTheme } from './config/theme'
import AppRouter from './router/AppRouter'

/** 全局 Provider：AntD 中文语言包 + 设计令牌主题 + 消息/弹窗上下文 */
export default function App() {
  return (
    <ConfigProvider locale={zhCN} theme={appTheme}>
      <AntdApp>
        <AppRouter />
      </AntdApp>
    </ConfigProvider>
  )
}
