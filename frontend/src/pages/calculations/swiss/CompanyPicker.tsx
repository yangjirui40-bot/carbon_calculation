import type { CompanyDetail } from '../../../api/types'
import { SwissButton, SwissField, SwissSelect } from '../../../components/swiss'
import './CompanyPicker.css'

type CompanyPickerProps = {
  companies: CompanyDetail[]
  value: number | null
  loading: boolean
  error: string | null
  onChange: (companyId: number | null) => void
  onRetry: () => void
}

/** 管理员/审计员未绑定企业时的企业选择器；企业账号不显示。 */
export default function CompanyPicker({
  companies,
  value,
  loading,
  error,
  onChange,
  onRetry,
}: CompanyPickerProps) {
  const hasCurrent = companies.some((company) => company.id === value)

  return (
    <div className="company-picker">
      <SwissField
        label="企业"
        htmlFor="calc-company"
        required
        hint="核算与历史任务都按所选企业隔离"
      >
        <SwissSelect
          id="calc-company"
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
            {loading ? '正在加载企业…' : '全部企业（仅查看历史）'}
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
        <div className="company-picker__error" role="alert">
          <span>{error}</span>
          <SwissButton variant="ghost" onClick={onRetry}>
            重新加载
          </SwissButton>
        </div>
      ) : null}
    </div>
  )
}
