import { useCallback, useEffect, useRef, useState } from 'react'
import { supplyChainApi } from '../../api'
import type {
  CarbonQuota,
  ReductionPlanRecord,
  SupplierRecord,
} from '../../api/types'
import { errorText } from './errors'

/**
 * 配额与减排计划页数据源：配额、计划、供应商名称映射一次并发加载。
 * 审计员不能带 company_id 查 suppliers（租户隔离），故取全量后在前端按企业过滤。
 */
export function useQuotasData(companyId: number | null, role: string | null) {
  const [quotas, setQuotas] = useState<CarbonQuota[]>([])
  const [plans, setPlans] = useState<ReductionPlanRecord[]>([])
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const lastCompanyRef = useRef<number | null>(null)

  useEffect(() => {
    const companyChanged = lastCompanyRef.current !== companyId
    lastCompanyRef.current = companyId

    if (companyId === null) {
      setQuotas([])
      setPlans([])
      setSuppliers([])
      setLoading(false)
      setError(null)
      return
    }

    let active = true
    if (companyChanged) {
      setQuotas([])
      setPlans([])
      setSuppliers([])
    }
    setLoading(true)
    setError(null)

    const supplierRequest =
      role === 'auditor'
        ? supplyChainApi.listSuppliers()
        : supplyChainApi.listSuppliers({ company_id: companyId })

    Promise.all([
      supplyChainApi.listQuotas(companyId),
      supplyChainApi.listReductionPlans(companyId),
      supplierRequest,
    ])
      .then(([quotaList, planList, supplierList]) => {
        if (!active) return
        setQuotas(quotaList)
        setPlans(planList)
        setSuppliers(
          supplierList.filter((supplier) => supplier.company_id === companyId),
        )
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (!active) return
        setQuotas([])
        setPlans([])
        setSuppliers([])
        setError(errorText(err, '配额与减排计划加载失败'))
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [companyId, role, reloadKey])

  const reload = useCallback(() => setReloadKey((key) => key + 1), [])

  return { quotas, plans, suppliers, loading, error, reload }
}
