import type { CompanyDetail } from '../../../api/types'
import SwissEmpty from '../../../components/swiss/SwissEmpty'
import SwissError from '../../../components/swiss/SwissError'
import SwissSelect from '../../../components/swiss/SwissSelect'
import './CompanySelector.css'

type CompanySelectorProps = {
  companies: CompanyDetail[]
  loading: boolean
  error: string | null
  onSelect: (companyId: number) => void
  onRetry: () => void
}

/** 账号未绑定企业时，先让用户选择要查看的企业 */
export default function CompanySelector({
  companies,
  loading,
  error,
  onSelect,
  onRetry,
}: CompanySelectorProps) {
  return (
    <section className="ws-gate" aria-label="选择企业">
      <div className="ws-gate__kicker">Account / company</div>
      <h2 className="ws-gate__title">选择企业</h2>
      <p className="ws-gate__desc">
        当前账号未绑定企业。选择要查看的企业后，工作台会读取该企业的核算与单据数据。
      </p>

      {loading ? (
        <p className="ws-gate__hint" role="status">
          正在加载企业列表…
        </p>
      ) : null}

      {!loading && error ? <SwissError message={error} onRetry={onRetry} /> : null}

      {!loading && !error && companies.length === 0 ? (
        <SwissEmpty
          title="暂无可选企业"
          description="企业列表为空，请联系管理员创建企业后重试。"
        />
      ) : null}

      {!loading && !error && companies.length > 0 ? (
        <div className="ws-gate__field">
          <label className="ws-gate__label" htmlFor="ws-company-select">
            企业
          </label>
          <SwissSelect
            id="ws-company-select"
            value=""
            onChange={(event) => {
              const nextId = Number(event.target.value)
              if (Number.isFinite(nextId) && nextId > 0) onSelect(nextId)
            }}
          >
            <option value="" disabled>
              请选择企业
            </option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name} · {company.industry}
              </option>
            ))}
          </SwissSelect>
        </div>
      ) : null}
    </section>
  )
}
