import type { CompanyDetail } from '../../../api/types'
import { SwissButton, SwissField, SwissSelect } from '../../../components/swiss'
import './CompanyScopeSelect.css'

type CompanyScopeSelectProps = {
  id: string
  label?: string
  companies: CompanyDetail[]
  value: number | null
  loading: boolean
  error: string | null
  /** 是否允许“全部企业”（仅列表类页面）；模拟器必须选择具体企业 */
  allowAll?: boolean
  hint?: string
  onChange: (companyId: number | null) => void
  onRetry: () => void
}

/** 管理员/审计员在未绑定企业时的企业选择器；企业账号不展示。 */
export default function CompanyScopeSelect({
  id,
  label = '企业',
  companies,
  value,
  loading,
  error,
  allowAll = false,
  hint,
  onChange,
  onRetry,
}: CompanyScopeSelectProps) {
  const hasCurrent = companies.some((company) => company.id === value)

  return (
    <div className="company-scope">
      <SwissField label={label} htmlFor={id} required hint={hint}>
        <SwissSelect
          id={id}
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
          <option value="">
            {loading
              ? '正在加载企业…'
              : allowAll
                ? '全部企业'
                : '请选择企业'}
          </option>
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
        <div className="company-scope__error" role="alert">
          <span>{error}</span>
          <SwissButton variant="ghost" onClick={onRetry}>
            重新加载
          </SwissButton>
        </div>
      ) : null}
    </div>
  )
}
