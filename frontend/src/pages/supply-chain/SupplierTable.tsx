import type { SupplierRecord } from '../../api/types'
import SwissTable, {
  type SwissTableColumn,
} from '../../components/swiss/SwissTable'
import { formatNumber } from '../../utils/format'
import RiskBadge from './RiskBadge'
import { tierLabel } from './constants'
import './shared.css'

const COLUMNS: SwissTableColumn[] = [
  { key: 'supplier_id', title: '编号', width: 108 },
  { key: 'name', title: '名称' },
  { key: 'industry', title: '行业', width: 112 },
  { key: 'region', title: '地区', width: 96 },
  { key: 'tier', title: '层级', width: 104 },
  { key: 'intensity', title: '碳强度', width: 96, align: 'right' },
  { key: 'emissions', title: '年排放', width: 104, align: 'right' },
  { key: 'risk', title: '风险等级', width: 148 },
]

/** 供应商档案表：碳强度 kgCO₂e/元，年排放 kgCO₂e */
export default function SupplierTable({
  suppliers,
  empty,
}: {
  suppliers: SupplierRecord[]
  empty: string
}) {
  const rows = suppliers.map((supplier) => ({
    _key: supplier.supplier_id,
    supplier_id: <span className="sc-cell-id">{supplier.supplier_id}</span>,
    name: <span className="sc-cell-name">{supplier.name}</span>,
    industry: supplier.industry ?? '—',
    region: supplier.region ?? '—',
    tier: tierLabel(supplier.tier),
    intensity: (
      <span className="num">{formatNumber(supplier.carbon_intensity, 3)}</span>
    ),
    emissions: (
      <span className="num">{formatNumber(supplier.annual_emissions, 2)}</span>
    ),
    risk: <RiskBadge level={supplier.risk_level} />,
  }))

  return (
    <SwissTable
      columns={COLUMNS}
      rows={rows}
      rowKey={(row) => String(row._key)}
      empty={empty}
    />
  )
}
