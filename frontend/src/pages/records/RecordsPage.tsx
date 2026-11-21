import { useEffect, useMemo, useState } from 'react'
import type { BusinessRecord } from '../../api/types'
import RecordClassificationDrawer from './RecordClassificationDrawer'
import {
  SwissButton,
  SwissEmpty,
  SwissError,
  SwissField,
  SwissSelect,
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
import { PAGE_SIZE, useRecordsData } from './useRecordsData'
import { getOrganization } from '../organization/companyData'
import type { Site } from '../organization/companyData'
import './records.css'

/** 业务记录：列表、筛选、新增、CSV/XLSX 导入与删除 */
export default function RecordsPage() {
  const session = readSession()
  const role = session?.user.role ?? null
  const canWrite = role === 'admin' || role === 'enterprise'
  const canPickCompany = role === 'admin'
  const sessionCompanyId = session?.user.company_id ?? null

  const { companyId: contextCompanyId, setCompanyId } = useCompany()

  const inheritedCompanyId = contextCompanyId ?? sessionCompanyId
  const displayCompanyId = role === 'admin' ? inheritedCompanyId : sessionCompanyId
  const queryCompanyId = displayCompanyId
  const writeCompanyId =
    role === 'enterprise'
      ? sessionCompanyId
      : role === 'admin'
        ? inheritedCompanyId
        : null
  const enterpriseBlocked = role === 'enterprise' && sessionCompanyId == null
  const canWriteNow = canWrite && writeCompanyId != null

  const [siteId,setSiteId] = useState<number>()
  const [sites,setSites] = useState<Site[]>([])
  useEffect(() => {
    setSiteId(undefined);setSites([])
    if (!queryCompanyId) return
    let active = true
    void getOrganization(queryCompanyId).then((data) => {if (active) setSites(data.sites)}).catch(() => {})
    return () => {active=false}
  },[queryCompanyId])
  const [period, setPeriod] = useState('')
  const [category, setCategory] = useState('')
  const [scope, setScope] = useState('')
  const [reviewStatus, setReviewStatus] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [selectedRecord, setSelectedRecord] = useState<BusinessRecord | null>(null)

  const { records, periods, total, page: shownPage, loading, error, reload } = useRecordsData({
    companyId: queryCompanyId,
    period, category, scope, reviewStatus, page, siteId,
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
    handleEdited,
  } = useRecordMutations({ companyId: writeCompanyId, onChanged: reload })

  const categoryOptions = useMemo(() => {
    const values = new Set<string>()
    records.forEach((record) => values.add(record.category))
    factors.forEach((factor) => values.add(factor.category))
    return Array.from(values).sort()
  }, [records, factors])

  const hasFilters = Boolean(period || category || scope || reviewStatus || siteId)
  const selectedCompanyName =
    canPickCompany && displayCompanyId != null
      ? (companies.find((company) => company.id === displayCompanyId)?.name ?? null)
      : null

  function clearFilters() {
    setPage(1)
    setPeriod('')
    setCategory('')
    setScope('')
    setReviewStatus('')
    setSiteId(undefined)
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
      <SwissMasthead kicker="数据" title="业务台账" description={description} actions={actions} />

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
              {loading ? '正在刷新…' : `共 ${total} 条`}
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

          {sites.length > 0 && <SwissField label="工厂" htmlFor="records-filter-site">
            <SwissSelect id="records-filter-site" value={siteId ?? ''} onChange={(event) => {
              setSiteId(Number(event.target.value)||undefined);setPage(1)
            }}>
              <option value="">全部工厂</option>
              {sites.map((site) => <option key={site.id} value={site.id}>{site.code} · {site.name}</option>)}
            </SwissSelect>
          </SwissField>}
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
            onPeriodChange={(value) => { setPeriod(value); setPage(1) }}
            category={category}
            categoryOptions={categoryOptions}
            onCategoryChange={(value) => { setCategory(value); setPage(1) }}
            scope={scope}
            onScopeChange={(value) => { setScope(value); setPage(1) }}
            reviewStatus={reviewStatus}
            onReviewStatusChange={(value) => { setReviewStatus(value); setPage(1) }}
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
              records={records}
              companies={companies}
              showCompany={canPickCompany && displayCompanyId == null}
              canWrite={canWrite}
              pendingDeleteNo={pendingDeleteNo}
              deleting={deleting}
              onEditClassification={setSelectedRecord}
              onRequestDelete={requestDelete}
              onConfirmDelete={() => void handleConfirmDelete()}
              onCancelDelete={cancelDelete}
              emptyText={hasFilters ? '没有符合筛选条件的记录' : '暂无记录'}
            />
          )}
          {!error && total > PAGE_SIZE && (
            <div className="records-pager" aria-label="台账分页">
              <SwissButton variant="ghost" disabled={loading || shownPage <= 1} onClick={() => setPage(shownPage - 1)}>上一页</SwissButton>
              <span aria-live="polite">{shownPage} / {Math.ceil(total / PAGE_SIZE)} 页</span>
              <SwissButton variant="ghost" disabled={loading || shownPage * PAGE_SIZE >= total} onClick={() => setPage(shownPage + 1)}>下一页</SwissButton>
            </div>
          )}
        </SwissSection>
      )}

      {selectedRecord && <RecordClassificationDrawer key={selectedRecord.id} record={selectedRecord}
        onClose={() => setSelectedRecord(null)} onChanged={(record, action) => {
          handleEdited(record, action)
          setSelectedRecord(null)
        }} />}
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
