import { SwissButton, SwissField, SwissSelect } from '../../components/swiss'
import { RISK_OPTIONS, RISK_LEVELS } from './constants'
import './shared.css'

type SupplierFiltersProps = {
  tier: string
  risk: string
  hasFilters: boolean
  onTierChange: (value: string) => void
  onRiskChange: (value: string) => void
  onClear: () => void
}

/** 供应商列表筛选：层级 / 风险 */
export default function SupplierFilters({
  tier,
  risk,
  hasFilters,
  onTierChange,
  onRiskChange,
  onClear,
}: SupplierFiltersProps) {
  return (
    <div className="sc-filters">
      <SwissField label="层级" htmlFor="supplier-filter-tier">
        <SwissSelect
          id="supplier-filter-tier"
          value={tier}
          onChange={(event) => onTierChange(event.target.value)}
        >
          <option value="">全部层级</option>
          <option value="1">一级供应商</option>
          <option value="2">二级供应商</option>
          <option value="3">三级供应商</option>
        </SwissSelect>
      </SwissField>

      <SwissField label="风险等级" htmlFor="supplier-filter-risk">
        <SwissSelect
          id="supplier-filter-risk"
          value={risk}
          onChange={(event) => onRiskChange(event.target.value)}
        >
          <option value="">全部风险</option>
          {RISK_LEVELS.map((level) => {
            const option = RISK_OPTIONS.find((item) => item.value === level)
            return (
              <option key={level} value={level}>
                {option?.label ?? level}
              </option>
            )
          })}
        </SwissSelect>
      </SwissField>

      {hasFilters ? (
        <div className="sc-filters__clear">
          <SwissButton variant="ghost" onClick={onClear}>
            清除筛选
          </SwissButton>
        </div>
      ) : null}
    </div>
  )
}
