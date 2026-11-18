import { Button } from 'antd'
import { Component, type ErrorInfo, type ReactNode } from 'react'
import ErrorState from './ErrorState'

type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
}

/**
 * 渲染异常兜底：避免某个页面报错导致整站白屏。
 * 只处理渲染树错误；接口错误仍由页面自己的 ErrorState 处理。
 */
export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 保留在控制台，便于演示现场排查；不向页面暴露堆栈
    console.error('页面渲染失败:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorState
          title="页面出错了"
          description="当前页面遇到未预期的问题，可以刷新后重试；如果反复出现，请记录下来反馈给开发。"
          extra={<Button onClick={() => window.location.reload()}>刷新页面</Button>}
        />
      )
    }
    return this.props.children
  }
}
