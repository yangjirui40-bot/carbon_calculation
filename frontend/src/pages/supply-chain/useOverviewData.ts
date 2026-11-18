import { useCallback, useEffect, useRef, useState } from 'react'
import { supplyChainApi } from '../../api'
import type {
  HeatmapResponse,
  SupplyChainNetwork,
  SupplyChainReport,
} from '../../api/types'
import { errorText } from './errors'

export type OverviewData = {
  network: SupplyChainNetwork
  heatmap: HeatmapResponse
  report: SupplyChainReport
}

/** 总览页数据源：网络拓扑、热力传播、供应链报告一次并发加载 */
export function useOverviewData(companyId: number | null) {
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const lastCompanyRef = useRef<number | null>(null)

  useEffect(() => {
    const companyChanged = lastCompanyRef.current !== companyId
    lastCompanyRef.current = companyId

    if (companyId === null) {
      setData(null)
      setLoading(false)
      setError(null)
      return
    }

    let active = true
    // 切换企业时先清空，避免旧企业数据短暂挂在页面上
    if (companyChanged) setData(null)
    setLoading(true)
    setError(null)

    Promise.all([
      supplyChainApi.getNetwork(companyId),
      supplyChainApi.getHeatmap(companyId),
      supplyChainApi.getSupplyChainReport(companyId),
    ])
      .then(([network, heatmap, report]) => {
        if (!active) return
        setData({ network, heatmap, report })
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (!active) return
        setData(null)
        setError(errorText(err, '供应链数据加载失败'))
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [companyId, reloadKey])

  const reload = useCallback(() => setReloadKey((key) => key + 1), [])

  return { data, loading, error, reload }
}
