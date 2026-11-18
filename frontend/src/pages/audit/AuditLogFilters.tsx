import {
  SwissButton,
  SwissField,
  SwissInput,
  SwissSelect,
} from '../../components/swiss'

const AUDIT_LIMIT_OPTIONS = [50, 100] as const

export type AuditLogFiltersProps = {
  draftRunId: string
  limit: number
  loading: boolean
  exporting: boolean
  canReset: boolean
  exportError: string
  onDraftRunIdChange: (value: string) => void
  onLimitChange: (value: number) => void
  onApply: () => void
  onReset: () => void
  onExport: () => void
}

/** 审计日志筛选栏：运行编号 + 条数；导出与查询共用已生效的运行编号 */
export default function AuditLogFilters({
  draftRunId,
  limit,
  loading,
  exporting,
  canReset,
  exportError,
  onDraftRunIdChange,
  onLimitChange,
  onApply,
  onReset,
  onExport,
}: AuditLogFiltersProps) {
  return (
    <div className="audit-filters">
      <form
        className="audit-filters__form"
        onSubmit={(event) => {
          event.preventDefault()
          onApply()
        }}
      >
        <SwissField
          label="运行编号"
          htmlFor="audit-filter-run"
          hint="留空查询全部日志"
        >
          <SwissInput
            id="audit-filter-run"
            type="text"
            value={draftRunId}
            placeholder="run-xxxxxxxxxxxx"
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => onDraftRunIdChange(event.target.value)}
          />
        </SwissField>

        <SwissField label="条数" htmlFor="audit-filter-limit" hint="上限 100 条">
          <SwissSelect
            id="audit-filter-limit"
            value={String(limit)}
            onChange={(event) => onLimitChange(Number(event.target.value))}
          >
            {AUDIT_LIMIT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option} 条
              </option>
            ))}
          </SwissSelect>
        </SwissField>

        <div className="audit-filters__actions">
          <SwissButton type="submit" loading={loading}>
            查询
          </SwissButton>
          <SwissButton variant="ghost" onClick={onReset} disabled={!canReset}>
            重置
          </SwissButton>
          <SwissButton
            variant="ghost"
            onClick={onExport}
            loading={exporting}
            disabled={loading}
          >
            导出 JSON
          </SwissButton>
        </div>
      </form>

      <p className="audit-filters__hint">
        按时间倒序返回；导出遵循当前已生效的运行编号筛选。
      </p>
      {exportError ? (
        <p className="audit-inline-error" role="alert">
          导出失败：{exportError}
        </p>
      ) : null}
    </div>
  )
}
