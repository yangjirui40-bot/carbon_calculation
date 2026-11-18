import { useEffect, useState } from 'react'
import { companiesApi } from '../../../api'
import type { CompanyDetail } from '../../../api/types'
import { toErrorMessage } from './errors'

/** 只为“企业编号”字段提供可选编号提示；不请求账号列表 */
export function useCompanyDirectory() {
  const [companies, setCompanies] = useState<CompanyDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
  }, [])

  return { companies, loading, error }
}
