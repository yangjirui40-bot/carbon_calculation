import { useMemo, useState } from 'react'
import {
  SwissButton,
  SwissEmpty,
  SwissError,
  SwissMasthead,
  SwissSection,
  SwissTabs,
} from '../../components/swiss'
import CompanyBar from './CompanyBar'
import QuotaCreateDrawer from './QuotaCreateDrawer'
import QuotaTable from './QuotaTable'
import ReductionPlanCreateDrawer from './ReductionPlanCreateDrawer'
import ReductionPlanTable from './ReductionPlanTable'
import SupplyChainSubnav from './SupplyChainSubnav'
import { QUOTA_UNIT } from './constants'
import { useQuotasData } from './useQuotasData'
import { useSupplyChainCompany } from './useSupplyChainCompany'
import './shared.css'
import './QuotasPage.css'

type QuotaTab = 'quotas' | 'plans'
type OpenDrawer = 'quota' | 'plan' | null

/** 配额与减排计划：配额表 + 计划表双页签，各带新建入口 */
export default function QuotasPage() {
  const scope = useSupplyChainCompany()
  const companyId = scope.effectiveCompanyId
  const { quotas, plans, suppliers, loading, error, reload } = useQuotasData(
    companyId,
    scope.role,
  )

  const [activeTab, setActiveTab] = useState<QuotaTab>('quotas')
  const [drawer, setDrawer] = useState<OpenDrawer>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const planIds = useMemo(() => plans.map((plan) => plan.plan_id), [plans])

  function handleCreated(message: string) {
    setDrawer(null)
    setSuccessMessage(message)
    reload()
  }

  const tabs = (
    <SwissTabs
      items={[
        { key: 'quotas', label: '配额', count: quotas.length },
        { key: 'plans', label: '减排计划', count: plans.length },
      ]}
      activeKey={activeTab}
      onChange={(key) => setActiveTab(key as QuotaTab)}
    />
  )

  return (
    <div className="sc-page">
      <SwissMasthead
        kicker="协同 / Quotas"
        title="配额与减排计划"
        description="为供应商分配碳配额，并跟踪减排计划的目标与进度。"
      />
      <SupplyChainSubnav />

      {scope.pickerVisible ? (
        <CompanyBar
          companies={scope.companies}
          value={companyId}
          loading={scope.pickerLoading}
          error={scope.pickerError}
          onChange={(id) => {
            setSuccessMessage(null)
            setDrawer(null)
            scope.selectCompany(id)
          }}
          onRetry={scope.reloadCompanies}
        />
      ) : null}

      {scope.unbound ? (
        <SwissError
          message="当前账号未绑定企业，无法查看配额与减排计划。请联系管理员。"
          backTo={{ to: '/workspace', label: '返回工作台' }}
        />
      ) : companyId === null ? (
        <SwissEmpty
          title="请选择企业"
          description="管理员与审计员需先在上方选择企业，再查看配额与减排计划。"
        />
      ) : error ? (
        <SwissError message={error} onRetry={reload} />
      ) : loading && quotas.length === 0 && plans.length === 0 ? (
        <div className="sc-state" role="status">
          正在加载配额与减排计划…
        </div>
      ) : (
        <>
          {tabs}

          {successMessage ? (
            <div className="sc-feedback sc-feedback--spaced" role="status">
              {successMessage}
            </div>
          ) : null}

          {activeTab === 'quotas' ? (
            <SwissSection
              kicker="Quotas"
              title="配额表"
              extra={
                <span>
                  数量单位 {QUOTA_UNIT}
                  {loading ? ' · 正在刷新' : ''}
                </span>
              }
            >
              {scope.canWrite ? (
                <div className="sc-section-actions">
                  <SwissButton onClick={() => setDrawer('quota')}>新建配额</SwissButton>
                </div>
              ) : null}

              {quotas.length === 0 ? (
                <SwissEmpty
                  title="还没有配额记录"
                  description={
                    scope.canWrite
                      ? '为供应商分配年度配额，剩余量为负时会标注超配额。'
                      : '当前企业尚未录入配额。'
                  }
                  action={
                    scope.canWrite ? (
                      <SwissButton onClick={() => setDrawer('quota')}>新建配额</SwissButton>
                    ) : undefined
                  }
                />
              ) : (
                <QuotaTable quotas={quotas} suppliers={suppliers} />
              )}
            </SwissSection>
          ) : (
            <SwissSection
              kicker="Plans"
              title="减排计划"
              extra={
                <span>
                  目标减排率按计划口径
                  {loading ? ' · 正在刷新' : ''}
                </span>
              }
            >
              {scope.canWrite ? (
                <div className="sc-section-actions">
                  <SwissButton onClick={() => setDrawer('plan')}>新建减排计划</SwissButton>
                </div>
              ) : null}

              {plans.length === 0 ? (
                <SwissEmpty
                  title="还没有减排计划"
                  description={
                    scope.canWrite
                      ? '建立减排计划后，可跟踪目标供应商的减排率与执行进度。'
                      : '当前企业尚未建立减排计划。'
                  }
                  action={
                    scope.canWrite ? (
                      <SwissButton onClick={() => setDrawer('plan')}>新建减排计划</SwissButton>
                    ) : undefined
                  }
                />
              ) : (
                <ReductionPlanTable plans={plans} suppliers={suppliers} />
              )}
            </SwissSection>
          )}
        </>
      )}

      <QuotaCreateDrawer
        open={drawer === 'quota'}
        companyId={companyId}
        suppliers={suppliers}
        onClose={() => setDrawer(null)}
        onCreated={() => handleCreated('配额已创建')}
      />

      <ReductionPlanCreateDrawer
        open={drawer === 'plan'}
        companyId={companyId}
        suppliers={suppliers}
        existingIds={planIds}
        onClose={() => setDrawer(null)}
        onCreated={() => handleCreated('减排计划已创建')}
      />
    </div>
  )
}
