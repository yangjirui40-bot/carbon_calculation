import type { CompanyDetail } from '../../../api/types'
import SwissEmpty from '../../../components/swiss/SwissEmpty'
import SwissError from '../../../components/swiss/SwissError'
import SwissSelect from '../../../components/swiss/SwissSelect'
import './CompanyGate.css'

type CompanyGateProps = {
  companies: CompanyDetail[]
  loading: boolean
  error: string | null
  onSelect: (companyId: number) => void
  onRetry: () => void
}

/** 账号未绑定企业时，选择要查看的驾驶舱 */
export default function CompanyGate({
  companies,
  loading,
  error,
  onSelect,
  onRetry,
}: CompanyGateProps) {
  return (
    <section className="dash-gate" aria-label="选择企业">
      <div className="dash-gate__kicker">Account / company</div>
      <h2 className="dash-gate__title">选择企业</h2>
      <p className="dash-gate__desc">
        当前账号未绑定企业。选择企业后，驾驶舱会读取该企业的排放结构与趋势。
      </p>

      {loading ? (
        <p className="dash-gate__hint" role="status">
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
        <div className="dash-gate__field">
          <label className="dash-gate__label" htmlFor="dash-company-select">
            企业
          </label>
          <SwissSelect
            id="dash-company-select"
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
