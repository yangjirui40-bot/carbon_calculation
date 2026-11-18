import { useState } from 'react'
import {
  SwissMasthead,
  SwissTabs,
  type SwissTabItem,
} from '../../components/swiss'
import HealthPanel from './HealthPanel'
import JobsPanel from './JobsPanel'
import OlapPanel from './OlapPanel'
import SchemaPanel from './SchemaPanel'
import './system.css'

const TABS: SwissTabItem[] = [
  { key: 'status', label: '运行状态' },
  { key: 'jobs', label: '任务队列' },
  { key: 'schema', label: '数据模型' },
  { key: 'olap', label: 'OLAP' },
]

/** 系统运维（仅管理员）：运行状态、任务队列、数据模型与 OLAP 重建 */
export default function SystemPage() {
  const [activeTab, setActiveTab] = useState('status')

  return (
    <div className="system-page">
      <SwissMasthead
        kicker="Admin"
        title="系统运维"
        description="查看服务健康与 AI 引擎状态、任务队列与数据建模；手动重建 OLAP 星型模型。"
      />

      <SwissTabs items={TABS} activeKey={activeTab} onChange={setActiveTab} />

      <div className="system-tab-body">
        {activeTab === 'status' ? <HealthPanel /> : null}
        {activeTab === 'jobs' ? <JobsPanel /> : null}
        {activeTab === 'schema' ? <SchemaPanel /> : null}
        {activeTab === 'olap' ? <OlapPanel /> : null}
      </div>
    </div>
  )
}
