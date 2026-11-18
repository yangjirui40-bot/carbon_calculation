import { useCallback, useEffect, useState } from 'react'
import { companiesApi } from '../../../api'
import type { CompanyDetail } from '../../../api/types'
import { toErrorMessage } from './errors'

/** 企业管理列表：加载、错误与手动刷新 */
export function useCompanyArchive() {
  const [companies, setCompanies] = useState<CompanyDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
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
  }, [reloadKey])

  const reload = useCallback(() => setReloadKey((key) => key + 1), [])

  return { companies, loading, error, reload }
}
