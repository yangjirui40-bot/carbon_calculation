import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { productsApi } from '../../api'
import type { BomMatchResult, ProductBomLine, ProductDetail } from '../../api/types'
import {
  SwissButton,
  SwissError,
  SwissMasthead,
  SwissSection,
  SwissStat,
  SwissTable,
} from '../../components/swiss'
import type { SwissTableColumn } from '../../components/swiss'
import BomFactorDrawer from './swiss/BomFactorDrawer'
import BomImportDrawer from './swiss/BomImportDrawer'
import BomTable from './swiss/BomTable'
import ProductStudiesPanel from './swiss/ProductStudiesPanel'
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

  const [itemToReview, selectItem] = useState<ProductBomLine | null>(null)
  const [reportLanguage, setLanguage] = useState('zh')
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
      setPcfResponse(null)
      setNotice(`语义匹配完成，本次自动处理 ${result.matched_items.length} 条物料。`)
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
      const response = await productsApi.generateProductReport(productId, reportLanguage, pcfResponse?.run_id)
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
                    匹配因子
                  </SwissButton>
                  <SwissButton
                    loading={calculating}
                    disabled={busy || bomEmpty}
                    onClick={() => void handleCalculate()}
                  >
                    PCF 核算
                  </SwissButton>
                  <select className="product-language" aria-label="报告语言" value={reportLanguage} onChange={(event) => setLanguage(event.target.value)}>
                    <option value="zh">报告 · 中文</option>
                    <option value="en">报告 · English</option>
                    <option value="de">报告 · Deutsch</option>
                    <option value="fr">报告 · Français</option>
                  </select>
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

            <p className="product-evidence-note">核算边界为 BOM 上游采购金额法。自动匹配后可逐项核对因子来源，人工指定项会保留。</p>
            <BomTable items={detail.bom_items} onSelect={canWrite && !busy ? selectItem : undefined} />
          </SwissSection>

          {matchResult ? (
            <SwissSection
              kicker="匹配结果"
              title="语义匹配结果"
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
              extra={<Link to={`/audit/runs/${pcfResponse.run_id}`}>查看计算与因子凭证 ↗</Link>}
            >
              <PcfResultPanel response={pcfResponse} />
            </SwissSection>
          ) : null}
        </>
      )}

      {detail && productId && <ProductStudiesPanel key={productId} productId={productId} canWrite={canWrite} />}
      {itemToReview && productId && (
        <BomFactorDrawer key={itemToReview.bom_item_id} item={itemToReview} productId={productId}
          onClose={() => selectItem(null)} onSaved={(updated) => {
            setDetail((current) => current ? { ...current, bom_items: current.bom_items.map((item) => item.bom_item_id === updated.bom_item_id ? updated : item) } : current)
            selectItem(null)
            setPcfResponse(null)
            setMatchResult(null)
            setNotice('已保存物料因子。请重新执行 PCF 核算。')
          }} />
      )}
      {canWrite && productId ? (
        <BomImportDrawer
          open={importOpen}
          productId={productId}
          onClose={() => setImportOpen(false)}
          onImported={(imported) => {
            if (imported > 0) { setPcfResponse(null); setMatchResult(null) }
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
