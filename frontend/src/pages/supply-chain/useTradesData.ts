import { useCallback, useEffect, useRef, useState } from 'react'
import { companiesApi, supplyChainApi } from '../../api'
import type {
  CompanyDetail,
  QuotaTrade,
  TradeReconciliation,
} from '../../api/types'
import { errorText } from './errors'

/** 配额交易页数据源：交易明细、对账摘要、企业名称映射一次并发加载 */
export function useTradesData(companyId: number | null) {
  const [trades, setTrades] = useState<QuotaTrade[]>([])
  const [reconciliation, setReconciliation] = useState<TradeReconciliation | null>(null)
  const [companies, setCompanies] = useState<CompanyDetail[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const lastCompanyRef = useRef<number | null>(null)

  useEffect(() => {
    const companyChanged = lastCompanyRef.current !== companyId
    lastCompanyRef.current = companyId

    if (companyId === null) {
      setTrades([])
      setReconciliation(null)
      setCompanies([])
      setLoading(false)
      setError(null)
      return
    }

    let active = true
    if (companyChanged) {
      setTrades([])
      setReconciliation(null)
    }
    setLoading(true)
    setError(null)

    Promise.all([
      supplyChainApi.listTrades(companyId),
      supplyChainApi.getTradeReconciliation(companyId),
      companiesApi.listCompanies(),
    ])
      .then(([tradeList, report, companyList]) => {
        if (!active) return
        setTrades(tradeList)
        setReconciliation(report)
        setCompanies(companyList)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (!active) return
        setTrades([])
        setReconciliation(null)
        setCompanies([])
        setError(errorText(err, '配额交易数据加载失败'))
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [companyId, reloadKey])

  const reload = useCallback(() => setReloadKey((key) => key + 1), [])

  return { trades, reconciliation, companies, loading, error, reload }
}
