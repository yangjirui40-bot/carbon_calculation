import { useMemo, useState } from 'react'
import type { SupplierRecord } from '../../api/types'
import {
  SwissButton,
  SwissEmpty,
  SwissError,
  SwissMasthead,
  SwissSection,
} from '../../components/swiss'
import CompanyBar from './CompanyBar'
import SupplierCreateDrawer from './SupplierCreateDrawer'
import SupplierFilters from './SupplierFilters'
import SupplierTable from './SupplierTable'
import SupplyChainSubnav from './SupplyChainSubnav'
import { useSuppliersData } from './useSuppliersData'
import { useSupplyChainCompany } from './useSupplyChainCompany'
import './shared.css'

/** 供应商档案：筛选、列表与新建；后端无更新/删除接口 */
export default function SuppliersPage() {
  const scope = useSupplyChainCompany()
  const companyId = scope.effectiveCompanyId
  const { suppliers, loading, error, reload } = useSuppliersData(companyId, scope.role)

  const [tier, setTier] = useState('')
  const [risk, setRisk] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let list = suppliers
    if (tier) list = list.filter((supplier) => String(supplier.tier) === tier)
    if (risk) list = list.filter((supplier) => supplier.risk_level === risk)
    return list
  }, [suppliers, tier, risk])

  const hasFilters = Boolean(tier || risk)
  const existingIds = useMemo(
    () => suppliers.map((supplier) => supplier.supplier_id),
    [suppliers],
  )

  function handleCreated(supplier: SupplierRecord) {
    setDrawerOpen(false)
    setSuccessMessage(`供应商 ${supplier.supplier_id} 已创建`)
    reload()
  }

  return (
    <div className="sc-page">
      <SwissMasthead
        kicker="协同 / Suppliers"
        title="供应商档案"
        description="维护供应链供应商的行业、地区、层级、碳强度与风险等级。"
        actions={
          scope.canWrite ? (
            <SwissButton
              onClick={() => setDrawerOpen(true)}
              disabled={companyId === null}
            >
              新建供应商
            </SwissButton>
          ) : undefined
        }
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
            scope.selectCompany(id)
          }}
          onRetry={scope.reloadCompanies}
        />
      ) : null}

      {scope.unbound ? (
        <SwissError
          message="当前账号未绑定企业，无法查看供应商档案。请联系管理员。"
          backTo={{ to: '/workspace', label: '返回工作台' }}
        />
      ) : companyId === null ? (
        <SwissEmpty
          title="请选择企业"
          description="管理员与审计员需先在上方选择企业，再查看该企业的供应商档案。"
        />
      ) : (
        <SwissSection
          kicker="Records"
          title="供应商列表"
          extra={
            <span>
              {loading ? '正在刷新…' : `共 ${filtered.length} 条`}
              {hasFilters ? '（已筛选）' : ''}
            </span>
          }
        >
          {successMessage ? (
            <div className="sc-feedback" role="status">
              {successMessage}
            </div>
          ) : null}

          <SupplierFilters
            tier={tier}
            risk={risk}
            hasFilters={hasFilters}
            onTierChange={setTier}
            onRiskChange={setRisk}
            onClear={() => {
              setTier('')
              setRisk('')
            }}
          />

          <p className="sc-hint">
            后端暂未提供供应商更新与删除接口，本页只支持新增；如需修改请联系数据管理员。
          </p>

          {error ? (
            <SwissError message={error} onRetry={reload} />
          ) : loading && suppliers.length === 0 ? (
            <div className="sc-state" role="status">
              正在加载供应商…
            </div>
          ) : suppliers.length === 0 ? (
            <SwissEmpty
              title="还没有供应商"
              description={
                scope.canWrite
                  ? '新建第一家供应商后，可在总览页维护关系边并查看风险传播。'
                  : '当前企业尚未录入供应商档案。'
              }
              action={
                scope.canWrite ? (
                  <SwissButton onClick={() => setDrawerOpen(true)}>新建供应商</SwissButton>
                ) : undefined
              }
            />
          ) : (
            <SupplierTable
              suppliers={filtered}
              empty={hasFilters ? '没有符合筛选条件的供应商' : '暂无供应商'}
            />
          )}
        </SwissSection>
      )}

      <SupplierCreateDrawer
        open={drawerOpen}
        companyId={companyId}
        existingIds={existingIds}
        onClose={() => setDrawerOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  )
}
