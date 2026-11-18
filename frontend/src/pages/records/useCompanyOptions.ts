import { useCallback, useEffect, useState } from 'react'
import { companiesApi } from '../../api'
import type { CompanyDetail } from '../../api/types'
import { useCompany } from '../../context/CompanyContext'
import { toErrorMessage } from './errors'

/**
 * 管理员/审计员的企业下拉数据。
 * 上下文里可能残留其他账号选过的企业，列表就绪后清掉失效选择。
 */
export function useCompanyOptions(enabled: boolean) {
  const { companyId, setCompanyId } = useCompany()
  const [companies, setCompanies] = useState<CompanyDetail[]>([])
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
    companiesApi
      .listCompanies()
      .then((data) => {
        if (cancelled) return
        setCompanies(data)
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
  }, [enabled, reloadKey])

  useEffect(() => {
    if (!enabled || loading || companies.length === 0) return
    if (companyId != null && !companies.some((company) => company.id === companyId)) {
      setCompanyId(null)
    }
  }, [enabled, loading, companies, companyId, setCompanyId])

  const reload = useCallback(() => setReloadKey((key) => key + 1), [])

  return { companies, loading, error, reload }
}
