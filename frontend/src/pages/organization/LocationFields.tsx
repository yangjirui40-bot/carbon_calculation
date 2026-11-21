import { useEffect, useState } from 'react'
import type { RecordClassification } from '../../api/types'
import { SwissField, SwissSelect } from '../../components/swiss'
import { errorText, getOrganization } from './companyData'
import type { Organization } from './companyData'

export default function LocationFields({ companyId, prefix, value, onChange }: {
  companyId: number | null; prefix: string; value: RecordClassification;
  onChange: (value: RecordClassification) => void
}) {
  const [data, setData] = useState<Organization>()
  const [error, setError] = useState('')
  useEffect(() => {
    if (!companyId) return
    let active = true
    void getOrganization(companyId)
      .then((org) => { if (active) { setData(org); setError('') } })
      .catch((failure: unknown) => { if (active) setError(errorText(failure)) })
    return () => { active = false }
  }, [companyId])
  if (error) return <p role="alert">{error}</p>
  if (!data?.sites.length) return null
  const sites = data.sites
  const units = data.org_units.filter((item) => item.site_id === value.site_id)
  return <>
    <SwissField label="工厂" htmlFor={prefix+'-site'}>
      <SwissSelect id={prefix+'-site'} value={value.site_id ?? ''} onChange={(event) => onChange({
        ...value, site_id: Number(event.target.value) || null, org_unit_id: null, workshop: null, production_line:null,
      })}>
        <option value="">未选择工厂</option>
        {sites.map((site) => <option key={site.id} value={site.id}>{site.code} · {site.name}</option>)}
      </SwissSelect>
    </SwissField>
    {value.site_id && <SwissField label="车间、产线或部门" htmlFor={prefix+'-org'}>
      <SwissSelect id={prefix+'-org'} value={value.org_unit_id ?? ''} onChange={(event) => onChange({
        ...value, org_unit_id: Number(event.target.value) || null, workshop: null, production_line:null,
      })}>
        <option value="">按工厂归集</option>
        {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.code} · {unit.name}</option>)}
      </SwissSelect>
    </SwissField>}
  </>
}
