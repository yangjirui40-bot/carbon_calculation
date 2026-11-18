import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { calculationsApi, productsApi, reportsApi } from '../../api'
import type {
  CalculationRunSummary,
  CompanyDetail,
  ProductRecord,
} from '../../api/types'
import {
  SwissButton,
  SwissDrawer,
  SwissField,
  SwissSelect,
  SwissTabs,
} from '../../components/swiss'
import { formatNumber } from '../../utils/format'
import { displayText, isReportNotFound } from './reportContent'
import { toErrorMessage } from './reportErrors'
import { formatBackendDateTime } from './reportMeta'
import './GenerateReportDrawer.css'

type ReportTab = 'iso14064' | 'pcf'

const REPORT_TABS = [
  { key: 'iso14064', label: 'ISO 14064' },
  { key: 'pcf', label: 'ISO 14067' },
]

type GenerateReportDrawerProps = {
  open: boolean
  onClose: () => void
  companyId: number | null
  companies: CompanyDetail[]
  companiesLoading: boolean
  onCompanyChange: (companyId: number | null) => void
}

/**
 * 生成报告抽屉：
 * ISO 14064 选企业 + 企业核算运行，PCF 选产品；成功后直接进入报告详情。
 */
export default function GenerateReportDrawer({
  open,
  onClose,
  companyId,
  companies,
  companiesLoading,
  onCompanyChange,
}: GenerateReportDrawerProps) {
  const navigate = useNavigate()
  const [tab, setTab] = useState<ReportTab>('iso14064')
  const [runs, setRuns] = useState<CalculationRunSummary[]>([])
  const [runsLoading, setRunsLoading] = useState(false)
  const [runsError, setRunsError] = useState<string | null>(null)
  const [selectedRunId, setSelectedRunId] = useState('')
  const [products, setProducts] = useState<ProductRecord[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [productsError, setProductsError] = useState<string | null>(null)
  const [selectedProductId, setSelectedProductId] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  useEffect(() => {
    setGenerateError(null)
  }, [open, tab, companyId])

  useEffect(() => {
    if (!open || tab !== 'iso14064') return
    if (companyId === null) {
      setRuns([])
      setSelectedRunId('')
      setRunsError(null)
      setRunsLoading(false)
      return
    }

    let cancelled = false
    setRuns([])
    setSelectedRunId('')
    setRunsLoading(true)
    setRunsError(null)

    calculationsApi
      .listRuns({ company_id: companyId, operation: 'enterprise' })
      .then((data) => {
        if (cancelled) return
        const usable = data.filter((run) => run.status === 'success')
        setRuns(usable)
        setSelectedRunId(usable[0]?.run_id ?? '')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setRuns([])
        setSelectedRunId('')
        setRunsError(toErrorMessage(error, '核算任务加载失败，请重试'))
      })
      .finally(() => {
        if (!cancelled) setRunsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, tab, companyId])

  useEffect(() => {
    if (!open || tab !== 'pcf') return

    let cancelled = false
    setProducts([])
    setSelectedProductId('')
    setProductsLoading(true)
    setProductsError(null)

    productsApi
      .listProducts(companyId === null ? {} : { company_id: companyId })
      .then((data) => {
        if (cancelled) return
        setProducts(data)
        setSelectedProductId(data[0]?.product_id ?? '')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setProducts([])
        setSelectedProductId('')
        setProductsError(toErrorMessage(error, '产品列表加载失败，请重试'))
      })
      .finally(() => {
        if (!cancelled) setProductsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, tab, companyId])

  const validRun =
    companyId !== null &&
    runs.some((run) => run.run_id === selectedRunId && run.company_id === companyId)
  const validProduct = products.some(
    (product) =>
      product.product_id === selectedProductId &&
      (companyId === null || product.company_id === companyId),
  )
  const canGenerate =
    !generating &&
    (tab === 'iso14064'
      ? validRun && !runsLoading
      : validProduct && !productsLoading)

  const handleClose = () => {
    if (!generating) onClose()
  }

  const handleGenerate = async () => {
    if (!canGenerate) return
    setGenerating(true)
    setGenerateError(null)

    try {
      if (tab === 'iso14064') {
        if (companyId === null || !selectedRunId) return
        const result = await reportsApi.generateIso14064({
          company_id: companyId,
          run_id: selectedRunId,
          language: 'zh',
        })
        if (isReportNotFound(result)) {
          setGenerateError('该核算任务没有可用的核算结果，请先完成一次企业核算。')
          return
        }
        onClose()
        navigate(`/reports/${encodeURIComponent(result.report_no)}`)
        return
      }

      if (!selectedProductId) return
      const result = await reportsApi.generatePcf({
        product_id: selectedProductId,
        language: 'zh',
      })
      if (isReportNotFound(result)) {
        setGenerateError('该产品没有可用的核算结果，请先完成产品核算。')
        return
      }
      onClose()
      navigate(`/reports/${encodeURIComponent(result.report_no)}`)
    } catch (error) {
      setGenerateError(toErrorMessage(error, '报告生成失败，请稍后重试'))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <SwissDrawer
      open={open}
      title="生成报告"
      onClose={handleClose}
      width={460}
      footer={
        <>
          <SwissButton variant="ghost" onClick={handleClose} disabled={generating}>
            取消
          </SwissButton>
          <SwissButton onClick={() => void handleGenerate()} loading={generating} disabled={!canGenerate}>
            生成报告
          </SwissButton>
        </>
      }
    >
      <div className="report-drawer">
        <p className="report-drawer__intro">
          选择报告类型与已完成的核算任务。生成成功后进入报告详情，可打印或下载 PDF / XML。
        </p>

        <SwissTabs
          items={REPORT_TABS}
          activeKey={tab}
          onChange={(key) => setTab(key === 'pcf' ? 'pcf' : 'iso14064')}
        />

        {tab === 'iso14064' ? (
          <div className="report-drawer__form">
            {companies.length > 0 ? (
              <SwissField
                label="企业"
                htmlFor="report-drawer-company"
                required
                hint="企业核算任务按所选企业加载。"
              >
                <SwissSelect
                  id="report-drawer-company"
                  value={companyId === null ? '' : String(companyId)}
                  onChange={(event) =>
                    onCompanyChange(event.target.value ? Number(event.target.value) : null)
                  }
                  disabled={companiesLoading || generating}
                >
                  <option value="">请选择企业</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {displayText(company.name)}
                    </option>
                  ))}
                </SwissSelect>
              </SwissField>
            ) : null}

            <SwissField
              label="企业核算任务"
              htmlFor="report-drawer-run"
              required
              hint="仅列出状态为成功的企业核算运行。"
            >
              <SwissSelect
                id="report-drawer-run"
                value={selectedRunId}
                onChange={(event) => setSelectedRunId(event.target.value)}
                disabled={runsLoading || generating || runs.length === 0}
              >
                {runs.length === 0 ? (
                  <option value="">{runsLoading ? '正在加载核算任务…' : '暂无可用核算任务'}</option>
                ) : (
                  runs.map((run) => (
                    <option key={run.run_id} value={run.run_id}>
                      {run.run_id} · {formatBackendDateTime(run.created_at)} ·{' '}
                      {formatNumber(run.total_kgco2e, 2)} kgCO₂e
                    </option>
                  ))
                )}
              </SwissSelect>
            </SwissField>

            {runsError ? (
              <p className="report-drawer__error" role="alert">
                {runsError}
              </p>
            ) : null}

            {!runsLoading && !runsError && companyId !== null && runs.length === 0 ? (
              <p className="report-drawer__hint">
                该企业暂无已完成的企业核算任务，请先到
                <Link to="/calculations">核算中心</Link>
                发起核算。
              </p>
            ) : null}

            {companyId === null ? (
              <p className="report-drawer__hint">请先选择企业，再选择该企业的核算任务。</p>
            ) : null}
          </div>
        ) : (
          <div className="report-drawer__form">
            <SwissField
              label="产品"
              htmlFor="report-drawer-product"
              required
              hint="产品列表按当前企业过滤；选择已核算的产品。"
            >
              <SwissSelect
                id="report-drawer-product"
                value={selectedProductId}
                onChange={(event) => setSelectedProductId(event.target.value)}
                disabled={productsLoading || generating || products.length === 0}
              >
                {products.length === 0 ? (
                  <option value="">{productsLoading ? '正在加载产品…' : '暂无可用产品'}</option>
                ) : (
                  products.map((product) => (
                    <option key={product.product_id} value={product.product_id}>
                      {displayText(product.product_name)} · {product.product_id}
                    </option>
                  ))
                )}
              </SwissSelect>
            </SwissField>

            {productsError ? (
              <p className="report-drawer__error" role="alert">
                {productsError}
              </p>
            ) : null}

            {!productsLoading && !productsError && products.length === 0 ? (
              <p className="report-drawer__hint">
                当前企业还没有产品，或产品尚未完成核算。可先到
                <Link to="/products">产品碳足迹</Link>
                维护产品。
              </p>
            ) : null}
          </div>
        )}

        {generateError ? (
          <p className="report-drawer__error" role="alert">
            {generateError}
          </p>
        ) : null}
      </div>
    </SwissDrawer>
  )
}
