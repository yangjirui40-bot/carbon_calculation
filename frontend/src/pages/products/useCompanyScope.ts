import { useCallback, useEffect, useMemo, useState } from 'react'
import { companiesApi } from '../../api'
import type { CompanyDetail } from '../../api/types'
import { readSession } from '../../api/modules/auth'
import { useCompany } from '../../context/CompanyContext'
import { errorMessage } from './labels'

/**
 * 产品碳足迹与模拟器共用的企业解析：
 * - 企业账号以会话里的 company_id 为准；
 * - admin/auditor 使用全局公司上下文；未选择时展示选择器；
 * - 始终加载企业列表用于选择器与名称映射（企业账号只返回本企业）。
 */
export function useCompanyScope() {
  const { companyId: contextCompanyId, setCompanyId } = useCompany()
  const session = readSession()
  const sessionCompanyId = session?.user.company_id ?? null
  const sessionRole = session?.user.role ?? null

  const canSelectCompany = sessionRole === 'admin' || sessionRole === 'auditor'
  const effectiveCompanyId = canSelectCompany
    ? (sessionCompanyId ?? contextCompanyId)
    : sessionCompanyId
  const pickerVisible = sessionCompanyId === null && canSelectCompany
  const canWrite = sessionRole === 'admin' || sessionRole === 'enterprise'

  const [companies, setCompanies] = useState<CompanyDetail[]>([])
  const [companiesLoading, setCompaniesLoading] = useState(true)
  const [companiesError, setCompaniesError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let active = true
    setCompaniesLoading(true)
    setCompaniesError(null)
    companiesApi
      .listCompanies()
      .then((list) => {
        if (active) setCompanies(list)
      })
      .catch((error: unknown) => {
        if (active) {
          setCompanies([])
          setCompaniesError(errorMessage(error))
        }
      })
      .finally(() => {
        if (active) setCompaniesLoading(false)
      })

    return () => {
      active = false
    }
  }, [reloadToken])

  const selectCompany = useCallback(
    (id: number | null) => {
      setCompanyId(id)
    },
    [setCompanyId],
  )

  const reloadCompanies = useCallback(() => {
    setReloadToken((token) => token + 1)
  }, [])

  const companyName = useCallback(
    (id: number | null) => {
      if (id === null) return '全部企业'
      return companies.find((company) => company.id === id)?.name ?? `企业 #${id}`
    },
    [companies],
  )

  return useMemo(
    () => ({
      effectiveCompanyId,
      pickerVisible,
      canWrite,
      companies,
      companiesLoading,
      companiesError,
      companyName,
      selectCompany,
      reloadCompanies,
    }),
    [
      effectiveCompanyId,
      pickerVisible,
      canWrite,
      companies,
      companiesLoading,
      companiesError,
      companyName,
      selectCompany,
      reloadCompanies,
    ],
  )
}
