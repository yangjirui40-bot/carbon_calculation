import { useCallback, useEffect, useState } from 'react'
import { recordsApi } from '../../api'
import type { BusinessRecord } from '../../api/types'
import { toErrorMessage } from './errors'

type UseRecordsDataOptions = {
  /** 传给后端的 company_id；审计员不传（后端按角色拒绝该过滤） */
  companyId: number | null
  period: string
  enabled: boolean
}

/**
 * 业务记录数据源：按 company_id / period 请求，维护加载与错误态，
 * 期间候选由已加载数据取并集，切企业后不清空以免选项闪烁。
 */
export function useRecordsData({ companyId, period, enabled }: UseRecordsDataOptions) {
  const [records, setRecords] = useState<BusinessRecord[]>([])
  const [periods, setPeriods] = useState<string[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)

    const params: { company_id?: number; period?: string } = {}
    if (companyId != null) params.company_id = companyId
    if (period) params.period = period

    recordsApi
      .listRecords(params)
      .then((data) => {
        if (cancelled) return
        setRecords(data)
        setPeriods((prev) => {
          const merged = new Set(prev)
          data.forEach((record) => merged.add(record.period))
          return Array.from(merged).sort()
        })
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(toErrorMessage(err))
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [companyId, period, enabled, reloadKey])

  const reload = useCallback(() => setReloadKey((key) => key + 1), [])

  return { records, periods, loading, error, reload }
}
