import type { ReactNode } from 'react'
import type { PCFResultData } from '../../../api/types'
import { SwissStat, SwissTable } from '../../../components/swiss'
import type { SwissTableColumn } from '../../../components/swiss'
import { formatAmount, formatEmission, formatNumber } from '../../../utils/format'
import { categoryLabel, formatQuantity, visibleWarnings } from '../labels'
import './PcfResultPanel.css'

type PcfResultPanelProps = {
  response: {
    run_id: string
    data: PCFResultData
    warnings?: string[] | null
  }
}

const COLUMNS: SwissTableColumn[] = [
  { key: 'itemId', title: '物料编号' },
  { key: 'material', title: '物料名称' },
  { key: 'category', title: '类别' },
  { key: 'amount', title: '金额', align: 'right' },
  { key: 'factor', title: '排放因子' },
  { key: 'factorValue', title: '因子值 (kgCO₂e/元)', align: 'right' },
  { key: 'emissions', title: '排放 (kgCO₂e)', align: 'right' },
]

/** PCF 核算结果：总量、单位产品排放与物料明细。 */
export default function PcfResultPanel({ response }: PcfResultPanelProps) {
  const data = response.data
  const warnings = visibleWarnings(
    Array.from(new Set([...(response.warnings ?? []), ...(data.warnings ?? [])])),
  )

  const rows = data.items.map<Record<string, ReactNode>>((item) => ({
    id: item.bom_item_id,
    itemId: <span className="pcf-code">{item.bom_item_id}</span>,
    material: item.material_name,
    category: categoryLabel(item.category),
    amount: <span className="pcf-num">{formatAmount(item.material_amount_cny)}</span>,
    factor: <span className="pcf-code">{item.factor_id}</span>,
    factorValue: <span className="pcf-num">{formatNumber(item.factor_kgco2e_per_cny, 2)}</span>,
    emissions: <span className="pcf-num">{formatEmission(item.emissions_kgco2e)}</span>,
  }))

  return (
    <div className="pcf-result">
      <div className="pcf-stats">
        <SwissStat
          label="总上游排放"
          value={formatEmission(data.total_upstream_emissions_kgco2e)}
          unit="kgCO₂e"
        />
        <SwissStat
          label="单位产品排放"
          value={formatNumber(data.unit_product_emissions_kgco2e, 2)}
          unit={data.unit_label}
          tone="accent"
        />
        <SwissStat
          label="产量"
          value={formatQuantity(data.output_quantity)}
          unit={data.product_unit}
        />
      </div>

      <p className="pcf-result__meta">
        运行 <span className="pcf-code">{response.run_id}</span> · 边界：{data.boundary}
        {data.factor_versions.length > 0
          ? ` · 因子版本：${data.factor_versions.join(' / ')}`
          : ''}
      </p>

      <SwissTable
        columns={COLUMNS}
        rows={rows}
        rowKey={(row) => String(row.id)}
        empty="核算结果没有物料明细"
      />

      {warnings.length > 0 ? (
        <ul className="pcf-result__warnings">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
