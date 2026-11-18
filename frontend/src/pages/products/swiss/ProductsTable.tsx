import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { CompanyDetail, ProductRecord } from '../../../api/types'
import {
  SwissEmpty,
  SwissError,
  SwissTable,
} from '../../../components/swiss'
import type { SwissTableColumn } from '../../../components/swiss'
import { formatQuantity } from '../labels'
import './ProductsTable.css'

type ProductsTableProps = {
  products: ProductRecord[]
  companies: CompanyDetail[]
  loading: boolean
  error: string | null
  onRetry: () => void
}

const COLUMNS: SwissTableColumn[] = [
  { key: 'productId', title: '产品编号' },
  { key: 'name', title: '产品名称' },
  { key: 'company', title: '企业' },
  { key: 'output', title: '产量', align: 'right' },
  { key: 'unit', title: '单位' },
  { key: 'description', title: '说明' },
  { key: 'action', title: '操作', align: 'right' },
]

/** 产品档案列表：只读表格 + 进入详情；写入由列表页的抽屉负责。 */
export default function ProductsTable({
  products,
  companies,
  loading,
  error,
  onRetry,
}: ProductsTableProps) {
  if (loading) {
    return (
      <div className="products-loading" role="status" aria-busy="true">
        正在加载产品档案…
      </div>
    )
  }

  if (error) {
    return <SwissError message={error} onRetry={onRetry} />
  }

  if (products.length === 0) {
    return (
      <SwissEmpty
        title="还没有产品档案"
        description="新建一个产品后，可以导入 BOM 并核算单位产品碳足迹。"
      />
    )
  }

  const companyNames = new Map(companies.map((company) => [company.id, company.name]))

  const rows = products.map<Record<string, ReactNode>>((product) => ({
    id: product.product_id,
    productId: <span className="products-code">{product.product_id}</span>,
    name: product.product_name,
    company: companyNames.get(product.company_id) ?? `企业 #${product.company_id}`,
    output: <span className="products-num">{formatQuantity(product.output_quantity)}</span>,
    unit: product.product_unit,
    description: product.description ? (
      <span className="products-desc" title={product.description}>
        {product.description}
      </span>
    ) : (
      '—'
    ),
    action: (
      <Link className="products-row-link" to={`/products/${encodeURIComponent(product.product_id)}`}>
        查看与核算
      </Link>
    ),
  }))

  return (
    <SwissTable
      columns={COLUMNS}
      rows={rows}
      rowKey={(row) => String(row.id)}
      empty="暂无产品"
    />
  )
}
