import { useMemo, useState } from 'react'
import { factorsApi } from '../../api'
import type { FactorRecord } from '../../api/types'
import {
  SwissButton,
  SwissEmpty,
  SwissError,
  SwissMasthead,
  SwissSection,
  SwissTable,
  SwissTabs,
  type SwissTabItem,
} from '../../components/swiss'
import { readSession } from '../../router/guards/RequireAuth'
import { DERIVED_COLUMNS, toDerivedRows } from './derivedRows'
import FactorCreateDrawer from './FactorCreateDrawer'
import FactorFilters from './FactorFilters'
import FactorSetsPanel from './FactorSetsPanel'
import FactorsAdminBar from './FactorsAdminBar'
import FactorsTable from './FactorsTable'
import { toErrorMessage } from './errors'
import { useFactorData } from './useFactorData'
import './factors.css'

/** 排放因子库：因子列表与因子集两个页签；管理员可新建、导入与派生 */
export default function FactorsPage() {
  const session = readSession()
  const isAdmin = session?.user.role === 'admin'

  const [activeTab, setActiveTab] = useState('list')
  const [category, setCategory] = useState('')
  const [version, setVersion] = useState('')

  const {
    factors,
    factorsLoading,
    factorsError,
    reloadFactors,
    setsData,
    setsLoading,
    setsError,
    reloadSets,
  } = useFactorData()

  const [createOpen, setCreateOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [deriving, setDeriving] = useState(false)
  const [derivedItems, setDerivedItems] = useState<Array<Record<string, unknown>> | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const categoryOptions = useMemo(() => {
    const values = new Set(factors.map((factor) => factor.category))
    return Array.from(values).sort()
  }, [factors])

  const versionOptions = useMemo(() => {
    const values = new Set(factors.map((factor) => factor.version))
    return Array.from(values).sort()
  }, [factors])

  const visibleFactors = useMemo(() => {
    let list = factors
    if (category) list = list.filter((factor) => factor.category === category)
    if (version) list = list.filter((factor) => factor.version === version)
    return list
  }, [factors, category, version])

  const hasFilters = Boolean(category || version)

  const tabs: SwissTabItem[] = [
    { key: 'list', label: '因子列表', count: factors.length },
    {
      key: 'sets',
      label: '因子集',
      count: setsData ? Object.keys(setsData.sets).length : undefined,
    },
  ]

  function clearActionMessages() {
    setSuccessMessage(null)
    setActionError(null)
    setDerivedItems(null)
  }

  async function handleImportFile(file: File) {
    clearActionMessages()
    setImporting(true)
    try {
      const result = await factorsApi.importFactors(file)
      setSuccessMessage(`导入完成：处理 ${result.imported} 条因子。`)
      reloadFactors()
    } catch (err) {
      setActionError(toErrorMessage(err))
    } finally {
      setImporting(false)
    }
  }

  async function handleDerive() {
    clearActionMessages()
    setDeriving(true)
    try {
      const result = await factorsApi.deriveFromIO()
      setDerivedItems(result.derived)
      setSuccessMessage(`派生完成：${result.derived.length} 个因子已写入因子库。`)
      reloadFactors()
    } catch (err) {
      setActionError(toErrorMessage(err))
    } finally {
      setDeriving(false)
    }
  }

  function handleCreated(factor: FactorRecord) {
    setCreateOpen(false)
    setSuccessMessage(`已新增因子 ${factor.factor_id}。`)
    setActionError(null)
    reloadFactors()
  }

  return (
    <div className="factors-page">
      <SwissMasthead
        kicker="数据"
        title="排放因子库"
        description="查看因子来源与因子集；管理员在此维护、导入与派生因子。"
      />

      <SwissTabs items={tabs} activeKey={activeTab} onChange={setActiveTab} />

      {activeTab === 'list' ? (
        <SwissSection
          kicker="Factors"
          title="因子列表"
          extra={
            isAdmin ? (
              <FactorsAdminBar
                importing={importing}
                deriving={deriving}
                onImportFile={(file) => void handleImportFile(file)}
                onDerive={() => void handleDerive()}
                onOpenCreate={() => setCreateOpen(true)}
              />
            ) : undefined
          }
        >
          {successMessage ? (
            <div className="factors-feedback" role="status">
              {successMessage}
            </div>
          ) : null}
          {actionError ? (
            <div className="factors-feedback factors-feedback--fail" role="alert">
              {actionError}
            </div>
          ) : null}
          {derivedItems ? (
            <div className="factors-derived">
              <div className="factors-derived__head">派生结果</div>
              <SwissTable
                columns={DERIVED_COLUMNS}
                rows={toDerivedRows(derivedItems)}
                rowKey={(row) => String(row.key)}
                empty="后端没有返回派生因子"
              />
            </div>
          ) : null}

          <FactorFilters
            category={category}
            categoryOptions={categoryOptions}
            onCategoryChange={setCategory}
            version={version}
            versionOptions={versionOptions}
            onVersionChange={setVersion}
            hasFilters={hasFilters}
            onClear={() => {
              setCategory('')
              setVersion('')
            }}
            count={visibleFactors.length}
            loading={factorsLoading}
          />

          {factorsError ? (
            <SwissError message={factorsError} onRetry={reloadFactors} />
          ) : factorsLoading && factors.length === 0 ? (
            <div className="factors-state" role="status">
              正在加载因子…
            </div>
          ) : factors.length === 0 ? (
            <SwissEmpty
              title="因子库为空"
              description={
                isAdmin
                  ? '管理员可新建因子，或导入 CSV 批量维护因子库。'
                  : '当前没有可展示的因子。'
              }
              action={
                isAdmin ? (
                  <SwissButton onClick={() => setCreateOpen(true)}>新建因子</SwissButton>
                ) : undefined
              }
            />
          ) : (
            <FactorsTable
              factors={visibleFactors}
              emptyText={hasFilters ? '没有符合筛选条件的因子' : '暂无因子'}
            />
          )}
        </SwissSection>
      ) : (
        <SwissSection kicker="Factor sets" title="因子集">
          <FactorSetsPanel
            data={setsData}
            loading={setsLoading}
            error={setsError}
            onRetry={reloadSets}
          />
        </SwissSection>
      )}

      <FactorCreateDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  )
}
