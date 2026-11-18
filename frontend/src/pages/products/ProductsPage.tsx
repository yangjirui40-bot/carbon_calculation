import { useCallback, useEffect, useState } from 'react'
import { productsApi } from '../../api'
import type { ProductRecord } from '../../api/types'
import {
  SwissButton,
  SwissMasthead,
  SwissSection,
} from '../../components/swiss'
import CompanyScopeSelect from './swiss/CompanyScopeSelect'
import ProductCreateDrawer from './swiss/ProductCreateDrawer'
import ProductsTable from './swiss/ProductsTable'
import { useCompanyScope } from './useCompanyScope'
import { errorMessage } from './labels'
import './ProductsPage.css'

/** 产品碳足迹列表：产品档案 + 新建入口；具体核算在产品详情页。 */
export default function ProductsPage() {
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

  const [products, setProducts] = useState<ProductRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1)
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    productsApi
      .listProducts(effectiveCompanyId === null ? {} : { company_id: effectiveCompanyId })
      .then((list) => {
        if (active) setProducts(list)
      })
      .catch((fetchError: unknown) => {
        if (active) {
          setProducts([])
          setError(errorMessage(fetchError))
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [effectiveCompanyId, reloadToken])

  return (
    <div className="products-page">
      <SwissMasthead
        kicker="核算 / Products"
        title="产品碳足迹"
        description="维护产品档案与 BOM，核算单位产品碳足迹并生成核查报告。"
        actions={
          canWrite ? (
            <SwissButton onClick={() => setDrawerOpen(true)}>新建产品</SwissButton>
          ) : undefined
        }
      />

      {pickerVisible ? (
        <div className="products-company">
          <CompanyScopeSelect
            id="products-company"
            companies={companies}
            value={effectiveCompanyId}
            loading={companiesLoading}
            error={companiesError}
            allowAll
            hint="不选择企业时展示全部企业产品（仅查看）"
            onChange={selectCompany}
            onRetry={reloadCompanies}
          />
        </div>
      ) : null}

      {notice ? (
        <div className="products-notice" role="status">
          {notice}
        </div>
      ) : null}

      <SwissSection
        kicker="产品档案"
        title="产品列表"
        extra={
          <span>
            {loading ? '加载中' : `共 ${products.length} 个产品`}
            {effectiveCompanyId === null ? ' · 全部企业' : ''}
          </span>
        }
      >
        <ProductsTable
          products={products}
          companies={companies}
          loading={loading}
          error={error}
          onRetry={reload}
        />
      </SwissSection>

      {canWrite ? (
        <ProductCreateDrawer
          open={drawerOpen}
          companies={companies}
          defaultCompanyId={effectiveCompanyId}
          onClose={() => setDrawerOpen(false)}
          onCreated={(product) => {
            setDrawerOpen(false)
            setNotice(`已创建产品 ${product.product_id}「${product.product_name}」，可在列表中进入核算。`)
            reload()
          }}
        />
      ) : null}
    </div>
  )
}
