import type { CompanyDetail } from '../../api/types'
import { SwissButton, SwissField, SwissSelect } from '../../components/swiss'

type BillingCompanyPickerProps = {
  companies: CompanyDetail[]
  value: number | null
  loading: boolean
  error: string | null
  onChange: (companyId: number | null) => void
  onRetry: () => void
}

/** 管理员/审计员选择要查看的企业；企业账号不渲染本组件 */
export default function BillingCompanyPicker({
  companies,
  value,
  loading,
  error,
  onChange,
  onRetry,
}: BillingCompanyPickerProps) {
  const hasCurrent = companies.some((company) => company.id === value)

  return (
    <div className="billing-picker">
      <SwissField
        label="企业"
        htmlFor="billing-company"
        required
        hint="订阅与用量按企业隔离；选择后加载该企业订阅。"
      >
        <SwissSelect
          id="billing-company"
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
        <div className="billing-picker__error" role="alert">
          <span>{error}</span>
          <SwissButton variant="ghost" className="billing-inline-btn" onClick={onRetry}>
            重新加载
          </SwissButton>
        </div>
      ) : null}
    </div>
  )
}
