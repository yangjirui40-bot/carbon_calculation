import { useCallback, useEffect, useState } from 'react'
import { factorsApi } from '../../api'
import type { FactorRecord, FactorSetsResponse } from '../../api/types'
import { toErrorMessage } from './errors'

/** 因子库数据源：因子列表与因子集各自维护加载/错误/重试 */
export function useFactorData() {
  const [factors, setFactors] = useState<FactorRecord[]>([])
  const [factorsLoading, setFactorsLoading] = useState(true)
  const [factorsError, setFactorsError] = useState<string | null>(null)
  const [factorsReload, setFactorsReload] = useState(0)

  const [setsData, setSetsData] = useState<FactorSetsResponse | null>(null)
  const [setsLoading, setSetsLoading] = useState(true)
  const [setsError, setSetsError] = useState<string | null>(null)
  const [setsReload, setSetsReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    setFactorsLoading(true)
    setFactorsError(null)
    factorsApi
      .listFactors()
      .then((data) => {
        if (cancelled) return
        setFactors(data)
        setFactorsLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setFactorsError(toErrorMessage(err))
        setFactorsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [factorsReload])

  useEffect(() => {
    let cancelled = false
    setSetsLoading(true)
    setSetsError(null)
    factorsApi
      .listFactorSets()
      .then((data) => {
        if (cancelled) return
        setSetsData(data)
        setSetsLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setSetsError(toErrorMessage(err))
        setSetsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [setsReload])

  const reloadFactors = useCallback(() => setFactorsReload((key) => key + 1), [])
  const reloadSets = useCallback(() => setSetsReload((key) => key + 1), [])

  return {
    factors,
    factorsLoading,
    factorsError,
    reloadFactors,
    setsData,
    setsLoading,
    setsError,
    reloadSets,
  }
}
