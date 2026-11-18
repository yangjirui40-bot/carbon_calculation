import { useCallback, useEffect, useMemo, useState } from 'react'
import { companiesApi } from '../../api'
import type { CompanyDetail } from '../../api/types'
import { readSession } from '../../api/modules/auth'
import { useCompany } from '../../context/CompanyContext'
import { errorMessage } from './labels'

/**
 * 解析当前核算使用的企业：
 * - 优先使用全局公司上下文 useCompany()（管理员可切换）；
 * - 其次回落到登录会话里的 company_id（企业账号）；
 * - 两者都为空时（管理员未选择）加载企业列表供选择。
 */
export function useCompanyScope() {
  const { companyId: contextCompanyId, setCompanyId } = useCompany()
  const session = readSession()
  const sessionCompanyId = session?.user.company_id ?? null
  const sessionRole = session?.user.role ?? null

  // 企业账号以会话中的 company_id 为准，不允许回落到 localStorage 里上一账号的选择；
  // 只有 admin/auditor 才使用全局上下文选择（选择器也仅对这两类角色显示）。
  const canSelectCompany = sessionRole === 'admin' || sessionRole === 'auditor'
  const effectiveCompanyId = canSelectCompany
    ? (sessionCompanyId ?? contextCompanyId)
    : sessionCompanyId
  const pickerVisible = sessionCompanyId === null && canSelectCompany

  const [companies, setCompanies] = useState<CompanyDetail[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)
  const [pickerError, setPickerError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!pickerVisible) {
      setCompanies([])
      setPickerError(null)
      setPickerLoading(false)
      return
    }

    let active = true
    setPickerLoading(true)
    setPickerError(null)
    companiesApi
      .listCompanies()
      .then((list) => {
        if (active) setCompanies(list)
      })
      .catch((error: unknown) => {
        if (active) setPickerError(errorMessage(error))
      })
      .finally(() => {
        if (active) setPickerLoading(false)
      })

    return () => {
      active = false
    }
  }, [pickerVisible, reloadToken])

  const selectCompany = useCallback(
    (id: number | null) => {
      setCompanyId(id)
    },
    [setCompanyId],
  )

  const reloadCompanies = useCallback(() => {
    setReloadToken((token) => token + 1)
  }, [])

  return useMemo(
    () => ({
      effectiveCompanyId,
      pickerVisible,
      companies,
      pickerLoading,
      pickerError,
      selectCompany,
      reloadCompanies,
    }),
    [
      effectiveCompanyId,
      pickerVisible,
      companies,
      pickerLoading,
      pickerError,
      selectCompany,
      reloadCompanies,
    ],
  )
}
