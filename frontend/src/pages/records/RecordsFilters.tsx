import { SwissButton, SwissField, SwissSelect } from '../../components/swiss'
import type { CompanyDetail } from '../../api/types'
import {
  REVIEW_STATUS_OPTIONS,
  SCOPE_OPTIONS,
  categoryLabel,
} from './constants'

export type RecordsFiltersProps = {
  showCompany: boolean
  companies: CompanyDetail[]
  companyId: number | null
  companiesLoading: boolean
  companiesError: string | null
  onCompanyChange: (id: number | null) => void
  onCompaniesRetry: () => void

  period: string
  periodOptions: string[]
  onPeriodChange: (value: string) => void
  category: string
  categoryOptions: string[]
  onCategoryChange: (value: string) => void
  scope: string
  onScopeChange: (value: string) => void
  reviewStatus: string
  onReviewStatusChange: (value: string) => void
  hasFilters: boolean
  onClear: () => void
}

/** 业务记录筛选栏：企业（管理员/审计员）、期间、类别、Scope、复核状态 */
export default function RecordsFilters({
  showCompany,
  companies,
  companyId,
  companiesLoading,
  companiesError,
  onCompanyChange,
  onCompaniesRetry,
  period,
  periodOptions,
  onPeriodChange,
  category,
  categoryOptions,
  onCategoryChange,
  scope,
  onScopeChange,
  reviewStatus,
  onReviewStatusChange,
  hasFilters,
  onClear,
}: RecordsFiltersProps) {
  return (
    <div className="records-filters">
      {showCompany ? (
        <SwissField
          label="企业"
          htmlFor="records-filter-company"
          hint={companiesError ? undefined : '管理员与审计员可切换企业'}
          error={companiesError ? `企业列表加载失败：${companiesError}` : undefined}
        >
          <SwissSelect
            id="records-filter-company"
            value={companyId == null ? '' : String(companyId)}
            disabled={companiesLoading}
            onChange={(event) => {
              const value = event.target.value
              onCompanyChange(value === '' ? null : Number(value))
            }}
          >
            <option value="">{companiesLoading ? '正在加载…' : '全部企业'}</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </SwissSelect>
          {companiesError ? (
            <SwissButton
              variant="ghost"
              className="records-inline-retry"
              onClick={onCompaniesRetry}
            >
              重试
            </SwissButton>
          ) : null}
        </SwissField>
      ) : null}

      <SwissField label="期间" htmlFor="records-filter-period">
        <SwissSelect
          id="records-filter-period"
          value={period}
          onChange={(event) => onPeriodChange(event.target.value)}
        >
          <option value="">全部期间</option>
          {periodOptions.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </SwissSelect>
      </SwissField>

      <SwissField label="类别" htmlFor="records-filter-category">
        <SwissSelect
          id="records-filter-category"
          value={category}
          onChange={(event) => onCategoryChange(event.target.value)}
        >
          <option value="">全部类别</option>
          {categoryOptions.map((value) => (
            <option key={value} value={value}>
              {categoryLabel(value)}
            </option>
          ))}
        </SwissSelect>
      </SwissField>

      <SwissField label="Scope" htmlFor="records-filter-scope">
        <SwissSelect
          id="records-filter-scope"
          value={scope}
          onChange={(event) => onScopeChange(event.target.value)}
        >
          <option value="">全部 Scope</option>
          {SCOPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SwissSelect>
      </SwissField>

      <SwissField label="复核状态" htmlFor="records-filter-review">
        <SwissSelect
          id="records-filter-review"
          value={reviewStatus}
          onChange={(event) => onReviewStatusChange(event.target.value)}
        >
          <option value="">全部状态</option>
          {REVIEW_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SwissSelect>
      </SwissField>

      <div className="records-filters__actions">
        <SwissButton
          variant="ghost"
          className="records-inline-button"
          onClick={onClear}
          disabled={!hasFilters}
        >
          清除筛选
        </SwissButton>
      </div>
    </div>
  )
}
