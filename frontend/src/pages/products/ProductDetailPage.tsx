import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { productsApi } from '../../api'
import type { BomMatchResult, ProductDetail } from '../../api/types'
import {
  SwissButton,
  SwissError,
  SwissMasthead,
  SwissSection,
  SwissStat,
  SwissTable,
} from '../../components/swiss'
import type { SwissTableColumn } from '../../components/swiss'
import BomImportDrawer from './swiss/BomImportDrawer'
import BomTable from './swiss/BomTable'
import PcfResultPanel from './swiss/PcfResultPanel'
import { useCompanyScope } from './useCompanyScope'
import {
  categoryLabel,
  errorMessage,
  formatConfidence,
  formatQuantity,
  visibleWarnings,
} from './labels'
import './ProductDetailPage.css'

const MATCH_COLUMNS: SwissTableColumn[] = [
  { key: 'material', title: '物料名称' },
  { key: 'matched', title: '匹配结果' },
  { key: 'category', title: '类别' },
  { key: 'factor', title: '排放因子' },
  { key: 'confidence', title: '置信度', align: 'right' },
]

/** 产品详情：BOM 维护、SBERT 匹配、PCF 核算与报告生成。 */
export default function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>()
  const navigate = useNavigate()
  const { canWrite, companyName } = useCompanyScope()

  const [detail, setDetail] = useState<ProductDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [importOpen, setImportOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])

  const [matching, setMatching] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [matchResult, setMatchResult] = useState<BomMatchResult | null>(null)
  const [pcfResponse, setPcfResponse] = useState<
    Awaited<ReturnType<typeof productsApi.calculateProduct>> | null
  >(null)

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1)
  }, [])

  useEffect(() => {
    if (!productId) {
      setDetail(null)
      setLoading(false)
      setLoadError('缺少产品编号')
      return
    }

    let active = true
    setLoading(true)
    setLoadError(null)
    productsApi
      .getProduct(productId)
      .then((product) => {
        if (active) setDetail(product)
      })
      .catch((error: unknown) => {
        if (active) {
          setDetail(null)
          setLoadError(errorMessage(error))
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [productId, reloadToken])

  async function handleMatch() {
    if (!productId || matching) return
    setMatching(true)
    setNotice(null)
    setActionError(null)
    setWarnings([])
    try {
      const result = await productsApi.matchBom(productId)
      setMatchResult(result)
      setNotice(`SBERT 匹配完成，共处理 ${result.matched_items.length} 条物料。`)
      reload()
    } catch (error) {
      setActionError(errorMessage(error))
    } finally {
      setMatching(false)
    }
  }

  async function handleCalculate() {
    if (!productId || calculating) return
    setCalculating(true)
    setNotice(null)
    setActionError(null)
    setWarnings([])
    try {
      const response = await productsApi.calculateProduct(productId)
      if (response.status === 'success') {
        setPcfResponse(response)
        setNotice(`PCF 核算完成，运行编号 ${response.run_id}。`)
        return
      }
      setPcfResponse(null)
      const nextWarnings = visibleWarnings(response.warnings)
      setWarnings(nextWarnings)
      setActionError(
        nextWarnings.length > 0
          ? '核算未完成，请查看下方提示'
          : '核算未完成，后端未返回更多信息',
      )
    } catch (error) {
      setPcfResponse(null)
      setActionError(errorMessage(error))
    } finally {
      setCalculating(false)
    }
  }

  async function handleReport() {
    if (!productId || reporting) return
    setReporting(true)
    setNotice(null)
    setActionError(null)
    try {
      const response = await productsApi.generateProductReport(productId)
      if ('report_no' in response) {
        navigate(`/reports/${response.report_no}`)
        return
      }
      setActionError('该产品还没有成功的 PCF 核算，请先完成一次核算再生成报告。')
    } catch (error) {
      setActionError(errorMessage(error))
    } finally {
      setReporting(false)
    }
  }

  const busy = matching || calculating || reporting
  const bomEmpty = (detail?.bom_items.length ?? 0) === 0

  const matchRows = (matchResult?.matched_items ?? []).map<Record<string, ReactNode>>(
    (item, index) => ({
      id: `${item.material_name}-${index}`,
      material: item.material_name,
      matched: item.matched ? (
        <span className="product-match product-match--ok">已匹配</span>
      ) : (
        <span className="product-match product-match--fail">未匹配</span>
      ),
      category: categoryLabel(item.matched_category),
      factor: item.matched_factor_id ? (
        <span className="product-code">{item.matched_factor_id}</span>
      ) : (
        '—'
      ),
      confidence: formatConfidence(item.confidence),
    }),
  )

  return (
    <div className="product-detail-page">
      <SwissMasthead
        kicker={`核算 / Products / ${productId ?? '—'}`}
        title={detail?.product_name ?? '产品详情'}
        description={detail?.description ?? '维护 BOM、匹配因子并核算产品碳足迹。'}
        backTo={{ to: '/products', label: '产品列表' }}
      />

      {notice ? (
        <div className="product-detail-notice" role="status">
          {notice}
        </div>
      ) : null}

      {loading ? (
        <div className="product-detail-loading" role="status" aria-busy="true">
          正在加载产品档案…
        </div>
      ) : loadError || !detail ? (
        <SwissError
          message={loadError ?? '产品不存在'}
          onRetry={reload}
          backTo={{ to: '/products', label: '返回产品列表' }}
        />
      ) : (
        <>
          <SwissSection
            kicker="产品信息"
            title="档案"
            extra={<span>编号 {detail.product_id}</span>}
          >
            <div className="product-detail-company">
              <span className="product-detail-company__label">所属企业</span>
              <span className="product-detail-company__name">
                {companyName(detail.company_id)}
              </span>
            </div>
            <div className="product-detail-stats">
              <SwissStat
                label="产量"
                value={formatQuantity(detail.output_quantity)}
                unit={detail.product_unit}
              />
              <SwissStat label="BOM 条目" value={detail.bom_items.length} unit="条" />
            </div>
          </SwissSection>

          <SwissSection
            kicker="BOM"
            title="物料清单"
            extra={
              <span>
                {bomEmpty
                  ? '未导入物料'
                  : `共 ${detail.bom_items.length} 条 · 金额口径为元`}
              </span>
            }
          >
            <div className="product-toolbar">
              {canWrite ? (
                <>
                  <SwissButton variant="ghost" disabled={busy} onClick={() => setImportOpen(true)}>
                    导入 BOM
                  </SwissButton>
                  <SwissButton
                    variant="ghost"
                    loading={matching}
                    disabled={busy || bomEmpty}
                    onClick={() => void handleMatch()}
                  >
                    SBERT 匹配
                  </SwissButton>
                  <SwissButton
                    loading={calculating}
                    disabled={busy || bomEmpty}
                    onClick={() => void handleCalculate()}
                  >
                    PCF 核算
                  </SwissButton>
                  <SwissButton
                    variant="ghost"
                    loading={reporting}
                    disabled={busy}
                    onClick={() => void handleReport()}
                  >
                    生成 PCF 报告
                  </SwissButton>
                </>
              ) : (
                <span className="product-toolbar__note">
                  审计角色为只读，BOM 导入、匹配与核算操作已隐藏。
                </span>
              )}
            </div>

            {actionError ? (
              <div className="product-detail-error" role="alert">
                {actionError}
                {warnings.length > 0 ? (
                  <ul>
                    {warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            <BomTable items={detail.bom_items} />
          </SwissSection>

          {matchResult ? (
            <SwissSection
              kicker="匹配结果"
              title="SBERT 语义匹配"
              extra={<span>最近一次匹配 · {matchResult.matched_items.length} 条</span>}
            >
              <SwissTable
                columns={MATCH_COLUMNS}
                rows={matchRows}
                rowKey={(row) => String(row.id)}
                empty="没有可匹配的物料"
              />
            </SwissSection>
          ) : null}

          {pcfResponse ? (
            <SwissSection
              kicker="核算结果"
              title="PCF 结果"
              extra={<span>运行 {pcfResponse.run_id}</span>}
            >
              <PcfResultPanel response={pcfResponse} />
            </SwissSection>
          ) : null}
        </>
      )}

      {canWrite && productId ? (
        <BomImportDrawer
          open={importOpen}
          productId={productId}
          onClose={() => setImportOpen(false)}
          onImported={(imported) => {
            setImportOpen(false)
            setActionError(null)
            setNotice(
              imported > 0
                ? `已导入 ${imported} 条 BOM 物料。`
                : '所有物料编号均已存在，未新增条目。',
            )
            reload()
          }}
        />
      ) : null}
    </div>
  )
}
