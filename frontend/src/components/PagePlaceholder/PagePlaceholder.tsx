import { Typography } from 'antd'
import './PagePlaceholder.css'

type PagePlaceholderProps = {
  title: string
  task: string
  path: string
}

/** F-03 阶段的页面占位：只说明“这里将来是什么”，不放假数据 */
export default function PagePlaceholder({ title, task, path }: PagePlaceholderProps) {
  return (
    <section className="page-placeholder">
      <Typography.Title level={3}>{title}</Typography.Title>
      <Typography.Paragraph type="secondary">
        当前路径 <Typography.Text code>{path}</Typography.Text>，页面内容在 {task} 实现。
      </Typography.Paragraph>
    </section>
  )
}
