import type { RecordClassification } from '../../api/types'
import { SwissField, SwissInput } from '../../components/swiss'
import { scope3Categories } from '../../config/scope3'
import LocationFields from '../organization/LocationFields'

export default function ClassificationFields({ scope, prefix, value, onChange, companyId }: {
  companyId?: number | null; scope: string; prefix: string; value: RecordClassification; onChange: (value: RecordClassification) => void
}) {
  return <>
    <LocationFields companyId={companyId ?? null} prefix={prefix} value={value} onChange={onChange}/>
    {!value.org_unit_id && <>
    <SwissField label="车间" htmlFor={`${prefix}-workshop`}>
      <SwissInput id={`${prefix}-workshop`} maxLength={80} value={value.workshop ?? ''}
        onChange={(event) => onChange({ ...value, workshop: event.target.value })} />
    </SwissField>
    <SwissField label="产线" htmlFor={`${prefix}-line`}>
      <SwissInput id={`${prefix}-line`} maxLength={80} value={value.production_line ?? ''}
        onChange={(event) => onChange({ ...value, production_line: event.target.value })} />
    </SwissField>
    </>}
    {scope === 'scope3' && <SwissField label="价值链分类" htmlFor={`${prefix}-category`}>
      <select className="swiss-input" id={`${prefix}-category`} value={value.scope3_category ?? ''}
        onChange={(event) => onChange({ ...value, scope3_category: Number(event.target.value) || null })}>
        <option value="">待归类</option>
        {scope3Categories.map((name, index) => <option key={name} value={index + 1}>{index + 1} · {name}</option>)}
      </select>
    </SwissField>}
  </>
}

export function normalizedClassification(value: RecordClassification, scope: string): RecordClassification {
  return {
    site_id: value.site_id, org_unit_id: value.org_unit_id,
    workshop: value.workshop?.trim() || null, production_line: value.production_line?.trim() || null,
    scope3_category: scope === 'scope3' ? value.scope3_category ?? null : null,
  }
}
