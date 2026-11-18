import { SwissButton, SwissField, SwissSelect } from '../../components/swiss'
import { categoryLabel } from './constants'

export type FactorFiltersProps = {
  category: string
  categoryOptions: string[]
  onCategoryChange: (value: string) => void
  version: string
  versionOptions: string[]
  onVersionChange: (value: string) => void
  hasFilters: boolean
  onClear: () => void
  count: number
  loading: boolean
}

/** 因子列表筛选：类别、版本；后端口径只支持这两个维度，其余在前端处理 */
export default function FactorFilters({
  category,
  categoryOptions,
  onCategoryChange,
  version,
  versionOptions,
  onVersionChange,
  hasFilters,
  onClear,
  count,
  loading,
}: FactorFiltersProps) {
  return (
    <div className="factors-filters">
      <SwissField label="类别" htmlFor="factors-filter-category">
        <SwissSelect
          id="factors-filter-category"
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

      <SwissField label="版本" htmlFor="factors-filter-version">
        <SwissSelect
          id="factors-filter-version"
          value={version}
          onChange={(event) => onVersionChange(event.target.value)}
        >
          <option value="">全部版本</option>
          {versionOptions.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </SwissSelect>
      </SwissField>

      <div className="factors-filters__actions">
        <span className="factors-count" role="status">
          {loading ? '正在刷新…' : `共 ${count} 条`}
        </span>
        <SwissButton
          variant="ghost"
          className="factors-inline-button"
          onClick={onClear}
          disabled={!hasFilters}
        >
          清除筛选
        </SwissButton>
      </div>
    </div>
  )
}
