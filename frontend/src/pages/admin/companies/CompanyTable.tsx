import type { CompanyDetail } from '../../../api/types'
import { SwissButton, SwissTable, type SwissTableColumn } from '../../../components/swiss'
import { EMPTY_VALUE, formatDateTime } from '../../../utils/format'

type CompanyTableProps = {
  companies: CompanyDetail[]
  onEdit: (company: CompanyDetail) => void
  onDelete: (company: CompanyDetail) => void
}

const COLUMNS: SwissTableColumn[] = [
  { key: 'code', title: '编号', width: 120 },
  { key: 'name', title: '名称' },
  { key: 'industry', title: '行业' },
  { key: 'region', title: '地区' },
  { key: 'scale', title: '规模', width: 80 },
  { key: 'contact', title: '联系人', width: 140 },
  { key: 'created_at', title: '创建时间', width: 140 },
  { key: 'actions', title: '操作', width: 130, align: 'right' },
]

/** 企业列表：编号、名称、行业、地区、规模、联系人、创建时间与行内操作 */
export default function CompanyTable({ companies, onEdit, onDelete }: CompanyTableProps) {
  const rows = companies.map((company) => ({
    id: company.id,
    code: company.code,
    name: company.name,
    industry: company.industry || EMPTY_VALUE,
    region: company.region ?? EMPTY_VALUE,
    scale: company.scale ?? EMPTY_VALUE,
    contact: company.contact_name ? (
      <span className="companies-contact">
        <span className="companies-contact__name">{company.contact_name}</span>
        {company.contact_phone ? (
          <span className="companies-contact__phone">{company.contact_phone}</span>
        ) : null}
      </span>
    ) : (
      EMPTY_VALUE
    ),
    created_at: formatDateTime(company.created_at),
    actions: (
      <div className="companies-actions">
        <SwissButton
          variant="ghost"
          className="companies-row-btn"
          aria-label={`编辑企业 ${company.name}`}
          onClick={() => onEdit(company)}
        >
          编辑
        </SwissButton>
        <SwissButton
          variant="danger"
          className="companies-row-btn"
          aria-label={`删除企业 ${company.name}`}
          onClick={() => onDelete(company)}
        >
          删除
        </SwissButton>
      </div>
    ),
  }))

  return (
    <SwissTable
      columns={COLUMNS}
      rows={rows}
      rowKey={(row) => String(row.id)}
      empty="还没有企业"
    />
  )
}
