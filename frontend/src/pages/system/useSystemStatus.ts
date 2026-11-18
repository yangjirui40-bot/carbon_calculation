import { useCallback, useEffect, useState } from 'react'
import { healthApi, systemApi } from '../../api'
import type { AIStatusResponse, HealthResponse } from '../../api/types'
import { toErrorMessage } from './errors'

/** 运行状态页签：健康检查与 AI 引擎状态各自独立加载/重试 */
export function useSystemStatus() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [healthLoading, setHealthLoading] = useState(true)
  const [healthError, setHealthError] = useState<string | null>(null)

  const [ai, setAi] = useState<AIStatusResponse | null>(null)
  const [aiLoading, setAiLoading] = useState(true)
  const [aiError, setAiError] = useState<string | null>(null)

  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    setHealthLoading(true)
    setHealthError(null)
    healthApi
      .getHealth()
      .then((data) => {
        if (!active) return
        setHealth(data)
        setHealthLoading(false)
      })
      .catch((error: unknown) => {
        if (!active) return
        setHealth(null)
        setHealthError(toErrorMessage(error))
        setHealthLoading(false)
      })
    return () => {
      active = false
    }
  }, [reloadKey])

  useEffect(() => {
    let active = true
    setAiLoading(true)
    setAiError(null)
    systemApi
      .getAiStatus()
      .then((data) => {
        if (!active) return
        setAi(data)
        setAiLoading(false)
      })
      .catch((error: unknown) => {
        if (!active) return
        setAi(null)
        setAiError(toErrorMessage(error))
        setAiLoading(false)
      })
    return () => {
      active = false
    }
  }, [reloadKey])

  const reload = useCallback(() => setReloadKey((key) => key + 1), [])

  return {
    health,
    healthLoading,
    healthError,
    ai,
    aiLoading,
    aiError,
    reload,
  }
}
