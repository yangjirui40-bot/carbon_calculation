import { useState } from 'react'
import {
  SwissEmpty,
  SwissMasthead,
  SwissTabs,
} from '../../components/swiss'
import CompanyScopeSelect from '../products/swiss/CompanyScopeSelect'
import { useCompanyScope } from '../products/useCompanyScope'
import RoiTab from './swiss/RoiTab'
import ScenarioTab from './swiss/ScenarioTab'
import TrajectoryTab from './swiss/TrajectoryTab'
import './SimulatorPage.css'

const TABS = [
  { key: 'scenarios', label: '情景' },
  { key: 'trajectory', label: '轨迹' },
  { key: 'roi', label: 'ROI 测算' },
]

/** 减排路径模拟器：情景运行、轨迹对比与投资回报。 */
export default function SimulatorPage() {
  const {
    effectiveCompanyId,
    pickerVisible,
    canWrite,
    companies,
    companiesLoading,
    companiesError,
    selectCompany,
    reloadCompanies,
  } = useCompanyScope()
  const [activeKey, setActiveKey] = useState('scenarios')

  return (
    <div className="simulator-page">
      <SwissMasthead
        kicker="分析 / Simulator"
        title="减排路径模拟器"
        description="对比不同减排情景的排放轨迹，并测算投资的 ROI、NPV 与回收期。"
      />

      {pickerVisible ? (
        <div className="simulator-company">
          <CompanyScopeSelect
            id="simulator-company"
            companies={companies}
            value={effectiveCompanyId}
            loading={companiesLoading}
            error={companiesError}
            hint="情景与轨迹按企业加载；ROI 测算不依赖企业"
            onChange={selectCompany}
            onRetry={reloadCompanies}
          />
        </div>
      ) : null}

      <div className="simulator-tabs">
        <SwissTabs items={TABS} activeKey={activeKey} onChange={setActiveKey} />
      </div>

      <div className="simulator-body">
        {activeKey === 'scenarios' ? (
          effectiveCompanyId !== null ? (
            <ScenarioTab companyId={effectiveCompanyId} canWrite={canWrite} />
          ) : (
            <SwissEmpty
              title={pickerVisible ? '请选择企业' : '当前账号未绑定企业'}
              description={
                pickerVisible
                  ? '在上方选择企业后，可运行减排情景并查看历史。'
                  : '请联系管理员绑定企业后，再使用减排情景与轨迹。'
              }
            />
          )
        ) : activeKey === 'trajectory' ? (
          effectiveCompanyId !== null ? (
            <TrajectoryTab companyId={effectiveCompanyId} />
          ) : (
            <SwissEmpty
              title={pickerVisible ? '请选择企业' : '当前账号未绑定企业'}
              description={
                pickerVisible
                  ? '在上方选择企业后，可查看历史与预测轨迹。'
                  : '请联系管理员绑定企业后，再查看减排轨迹。'
              }
            />
          )
        ) : (
          <RoiTab />
        )}
      </div>
    </div>
  )
}
