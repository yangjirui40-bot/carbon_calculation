import { useCallback, useEffect, useState } from 'react'
import { factorsApi } from '../../api'
import type { FactorRecord } from '../../api/types'
import { toErrorMessage } from './errors'

/** 新增表单与类别筛选用到的因子列表；失败不阻塞记录列表 */
export function useFactorsOptions() {
  const [factors, setFactors] = useState<FactorRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    factorsApi
      .listFactors()
      .then((data) => {
        if (cancelled) return
        setFactors(data)
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
  }, [reloadKey])

  const reload = useCallback(() => setReloadKey((key) => key + 1), [])

  return { factors, loading, error, reload }
}
