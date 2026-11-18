import { useMemo, useState } from 'react'
import {
  SwissButton,
  SwissEmpty,
  SwissError,
  SwissMasthead,
  SwissSection,
} from '../../components/swiss'
import { useCompany } from '../../context/CompanyContext'
import { readSession } from '../../router/guards/RequireAuth'
import RecordCreateDrawer from './RecordCreateDrawer'
import RecordsFilters from './RecordsFilters'
import RecordsTable from './RecordsTable'
import RecordsToolbar from './RecordsToolbar'
import { useCompanyOptions } from './useCompanyOptions'
import { useFactorsOptions } from './useFactorsOptions'
import { useRecordMutations } from './useRecordMutations'
import { useRecordsData } from './useRecordsData'
import './records.css'

/** 业务记录：列表、筛选、新增、CSV/XLSX 导入与删除 */
export default function RecordsPage() {
  const session = readSession()
  const role = session?.user.role ?? null
  const canWrite = role === 'admin' || role === 'enterprise'
  const canPickCompany = role === 'admin' || role === 'auditor'
  const sessionCompanyId = session?.user.company_id ?? null

  const { companyId: contextCompanyId, setCompanyId } = useCompany()

  // 公司优先级：上下文里选中的企业 > 会话绑定企业；审计员为 null 时用企业下拉
  const inheritedCompanyId = contextCompanyId ?? sessionCompanyId
  // 审计员查询不带 company_id（后端按角色拒绝该过滤），改为前端按所选企业过滤
  const queryCompanyId =
    role === 'enterprise'
      ? sessionCompanyId
      : role === 'admin'
        ? inheritedCompanyId
        : null
  const displayCompanyId =
    role === 'enterprise' ? sessionCompanyId : inheritedCompanyId
  const writeCompanyId =
    role === 'enterprise'
      ? sessionCompanyId
      : role === 'admin'
        ? inheritedCompanyId
        : null
  const enterpriseBlocked = role === 'enterprise' && sessionCompanyId == null
  const canWriteNow = canWrite && writeCompanyId != null

  const [period, setPeriod] = useState('')
  const [category, setCategory] = useState('')
  const [scope, setScope] = useState('')
  const [reviewStatus, setReviewStatus] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)

  const { records, periods, loading, error, reload } = useRecordsData({
    companyId: queryCompanyId,
    period,
    enabled: !enterpriseBlocked,
  })
  const {
    companies,
    loading: companiesLoading,
    error: companiesError,
    reload: reloadCompanies,
  } = useCompanyOptions(canPickCompany)
  const {
    factors,
    loading: factorsLoading,
    error: factorsError,
    reload: reloadFactors,
  } = useFactorsOptions()
  const {
    importing,
    deleting,
    pendingDeleteNo,
    successMessage,
    actionError,
    clearMessages,
    requestDelete,
    cancelDelete,
    handleImportFile,
    handleConfirmDelete,
    handleCreated,
  } = useRecordMutations({ companyId: writeCompanyId, onChanged: reload })

  const categoryOptions = useMemo(() => {
    const values = new Set<string>()
    records.forEach((record) => values.add(record.category))
    factors.forEach((factor) => values.add(factor.category))
    return Array.from(values).sort()
  }, [records, factors])

  const visibleRecords = useMemo(() => {
    let list = records
    if (role === 'auditor' && displayCompanyId != null) {
      list = list.filter((record) => record.company_id === displayCompanyId)
    }
    if (category) list = list.filter((record) => record.category === category)
    if (scope) list = list.filter((record) => record.scope === scope)
    if (reviewStatus) list = list.filter((record) => record.review_status === reviewStatus)
    return list
  }, [records, role, displayCompanyId, category, scope, reviewStatus])

  const hasFilters = Boolean(period || category || scope || reviewStatus)
  const selectedCompanyName =
    canPickCompany && displayCompanyId != null
      ? (companies.find((company) => company.id === displayCompanyId)?.name ?? null)
      : null

  function clearFilters() {
    setPeriod('')
    setCategory('')
    setScope('')
    setReviewStatus('')
  }

  const actions = canWrite ? (
    <RecordsToolbar
      canWrite={canWrite}
      canWriteNow={canWriteNow}
      importing={importing}
      onImportFile={(file) => void handleImportFile(file)}
      onCreate={() => setDrawerOpen(true)}
    />
  ) : undefined

  const description = selectedCompanyName
    ? `管理参与核算的活动数据与采购数据。当前企业：${selectedCompanyName}。`
    : '管理参与核算的活动数据与采购数据。'

  return (
    <div className="records-page">
      <SwissMasthead kicker="数据" title="业务记录" description={description} actions={actions} />

      {enterpriseBlocked ? (
        <SwissError
          message="当前账号未绑定企业，无法查看业务记录。请联系管理员。"
          backTo={{ to: '/workspace', label: '返回工作台' }}
        />
      ) : (
        <SwissSection
          kicker="Records"
          title="记录列表"
          extra={
            <span role="status">
              {loading ? '正在刷新…' : `共 ${visibleRecords.length} 条`}
            </span>
          }
        >
          {successMessage ? (
            <div className="records-feedback" role="status">
              {successMessage}
            </div>
          ) : null}
          {actionError ? (
            <div className="records-feedback records-feedback--fail" role="alert">
              {actionError}
            </div>
          ) : null}

          <RecordsFilters
            showCompany={canPickCompany}
            companies={companies}
            companyId={contextCompanyId}
            companiesLoading={companiesLoading}
            companiesError={companiesError}
            onCompanyChange={(id) => {
              clearMessages()
              cancelDelete()
              setCompanyId(id)
            }}
            onCompaniesRetry={reloadCompanies}
            period={period}
            periodOptions={periods}
            onPeriodChange={setPeriod}
            category={category}
            categoryOptions={categoryOptions}
            onCategoryChange={setCategory}
            scope={scope}
            onScopeChange={setScope}
            reviewStatus={reviewStatus}
            onReviewStatusChange={setReviewStatus}
            hasFilters={hasFilters}
            onClear={clearFilters}
          />

          {role === 'admin' && inheritedCompanyId == null ? (
            <p className="records-hint">
              当前展示全部企业的记录；新增与导入需要先选择具体企业。
            </p>
          ) : null}

          {error ? (
            <SwissError message={error} onRetry={reload} />
          ) : loading && records.length === 0 ? (
            <div className="records-state" role="status">
              正在加载业务记录…
            </div>
          ) : records.length === 0 && !hasFilters ? (
            <SwissEmpty
              title="还没有业务记录"
              description={
                canWrite
                  ? '新增一条记录，或导入 CSV/XLSX 批量录入活动数据与采购数据。'
                  : '当前范围没有业务记录。'
              }
              action={
                canWriteNow ? (
                  <SwissButton onClick={() => setDrawerOpen(true)}>新增记录</SwissButton>
                ) : undefined
              }
            />
          ) : (
            <RecordsTable
              records={visibleRecords}
              companies={companies}
              showCompany={canPickCompany && displayCompanyId == null}
              canWrite={canWrite}
              pendingDeleteNo={pendingDeleteNo}
              deleting={deleting}
              onRequestDelete={requestDelete}
              onConfirmDelete={() => void handleConfirmDelete()}
              onCancelDelete={cancelDelete}
              emptyText={hasFilters ? '没有符合筛选条件的记录' : '暂无记录'}
            />
          )}
        </SwissSection>
      )}

      <RecordCreateDrawer
        open={drawerOpen}
        companyId={writeCompanyId}
        factors={factors}
        factorsLoading={factorsLoading}
        factorsError={factorsError}
        onRetryFactors={reloadFactors}
        onClose={() => setDrawerOpen(false)}
        onCreated={(record) => {
          setDrawerOpen(false)
          handleCreated(record)
        }}
      />
    </div>
  )
}
