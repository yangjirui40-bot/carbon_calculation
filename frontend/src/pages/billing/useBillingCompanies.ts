import { useCallback, useEffect, useState } from 'react'
import { companiesApi } from '../../api'
import type { CompanyDetail } from '../../api/types'
import { toErrorMessage } from './errors'

/** admin/auditor 的企业选择器数据；企业账号不请求 */
export function useBillingCompanies(enabled: boolean) {
  const [companies, setCompanies] = useState<CompanyDetail[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!enabled) {
      setCompanies([])
      setLoading(false)
      setError(null)
      return
    }

    let active = true
    setLoading(true)
    setError(null)
    companiesApi
      .listCompanies()
      .then((list) => {
        if (!active) return
        setCompanies(list)
        setLoading(false)
      })
      .catch((requestError: unknown) => {
        if (!active) return
        setCompanies([])
        setError(toErrorMessage(requestError))
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [enabled, reloadKey])

  const reload = useCallback(() => setReloadKey((key) => key + 1), [])

  return { companies, loading, error, reload }
}
