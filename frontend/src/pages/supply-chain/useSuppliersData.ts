import { useCallback, useEffect, useRef, useState } from 'react'
import { supplyChainApi } from '../../api'
import type { SupplierRecord } from '../../api/types'
import { errorText } from './errors'

/**
 * 供应商档案数据源：按企业加载，新建后调用 reload 刷新。
 * 后端 suppliers 列表对审计员拒绝 company_id 过滤（租户隔离），
 * 所以审计员不带参数取全量，再在前端按 company_id 收敛到所选企业。
 */
export function useSuppliersData(
  companyId: number | null,
  role: string | null,
) {
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const lastCompanyRef = useRef<number | null>(null)

  useEffect(() => {
    const companyChanged = lastCompanyRef.current !== companyId
    lastCompanyRef.current = companyId

    if (companyId === null) {
      setSuppliers([])
      setLoading(false)
      setError(null)
      return
    }

    let active = true
    if (companyChanged) setSuppliers([])
    setLoading(true)
    setError(null)

    const request =
      role === 'auditor'
        ? supplyChainApi.listSuppliers()
        : supplyChainApi.listSuppliers({ company_id: companyId })

    request
      .then((list) => {
        if (!active) return
        setSuppliers(list.filter((supplier) => supplier.company_id === companyId))
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (!active) return
        setSuppliers([])
        setError(errorText(err, '供应商列表加载失败'))
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [companyId, role, reloadKey])

  const reload = useCallback(() => setReloadKey((key) => key + 1), [])

  return { suppliers, loading, error, reload }
}
