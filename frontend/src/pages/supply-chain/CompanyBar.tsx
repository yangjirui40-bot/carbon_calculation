import type { CompanyDetail } from '../../api/types'
import { SwissButton, SwissField, SwissSelect } from '../../components/swiss'
import './shared.css'

type CompanyBarProps = {
  companies: CompanyDetail[]
  value: number | null
  loading: boolean
  error: string | null
  onChange: (companyId: number | null) => void
  onRetry: () => void
}

/** 管理员/审计员未绑定企业时的企业选择条；企业账号不显示 */
export default function CompanyBar({
  companies,
  value,
  loading,
  error,
  onChange,
  onRetry,
}: CompanyBarProps) {
  const hasCurrent = companies.some((company) => company.id === value)

  return (
    <div className="sc-company-bar">
      <SwissField
        label="企业"
        htmlFor="sc-company"
        required
        hint="供应链数据按所选企业隔离"
      >
        <SwissSelect
          id="sc-company"
          value={value === null ? '' : String(value)}
          disabled={loading || Boolean(error)}
          onChange={(event) => {
            if (event.target.value === '') {
              onChange(null)
              return
            }
            const next = Number(event.target.value)
            if (Number.isFinite(next) && next > 0) onChange(next)
          }}
        >
          <option value="">{loading ? '正在加载企业…' : '请选择企业'}</option>
          {!hasCurrent && value !== null ? (
            <option value={String(value)}>企业 #{value}</option>
          ) : null}
          {companies.map((company) => (
            <option key={company.id} value={String(company.id)}>
              {company.name}（{company.code}）
            </option>
          ))}
        </SwissSelect>
      </SwissField>

      {error ? (
        <div className="sc-company-bar__error" role="alert">
          <span>{error}</span>
          <SwissButton variant="ghost" onClick={onRetry}>
            重新加载
          </SwissButton>
        </div>
      ) : null}
    </div>
  )
}
