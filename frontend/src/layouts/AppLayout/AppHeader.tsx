import { QuestionCircleOutlined } from '@ant-design/icons'
import { Button, Layout, Tooltip } from 'antd'
import { Link } from 'react-router-dom'
import { demoCompany } from '../../mocks/demoCompany'
import './AppHeader.css'

/** 顶部栏：品牌 + 企业名（左），帮助（右） */
export default function AppHeader() {
  return (
    <Layout.Header className="app-header">
      <div className="app-header__left">
        <Link to="/" className="app-header__brand">
          碳速算
        </Link>
        <span className="app-header__company">
          企业：<strong>{demoCompany.name}</strong>
        </span>
      </div>
      <div className="app-header__right">
        <Tooltip title="数字来源说明（即将上线）">
          <Button
            shape="circle"
            icon={<QuestionCircleOutlined />}
            aria-label="帮助"
            disabled
          />
        </Tooltip>
      </div>
    </Layout.Header>
  )
}
