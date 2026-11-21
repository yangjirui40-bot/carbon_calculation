import { useCallback, useEffect, useState } from 'react'
import { recordsApi } from '../../api'
import { toErrorMessage } from './errors'

type Result = Awaited<ReturnType<typeof recordsApi.pageRecords>>
const empty: Result = { records: [], periods: [], total: 0, page: 1 }

export const PAGE_SIZE = 50
export function useRecordsData({ companyId, period, category, scope, reviewStatus, enabled, page, siteId }: {
  companyId: number | null; period: string; category: string; scope: string; reviewStatus: string
  enabled: boolean; page: number; siteId?: number
}) {
  const [result, setResult] = useState<Result>(empty)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setLoading(true)
    setError(null)
    recordsApi.pageRecords({
      company_id: companyId ?? undefined, period: period || undefined, category: category || undefined,
      scope: scope || undefined, review_status: reviewStatus || undefined, site_id: siteId, page, size: PAGE_SIZE,
    }).then((data) => {
      if (!cancelled) setResult(data)
    }).catch((err: unknown) => {
      if (!cancelled) setError(toErrorMessage(err))
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [companyId, period, category, scope, reviewStatus, page, siteId, enabled, reloadKey])

  const reload = useCallback(() => setReloadKey((key) => key + 1), [])
  return { ...result, loading: enabled && loading, error, reload }
}
