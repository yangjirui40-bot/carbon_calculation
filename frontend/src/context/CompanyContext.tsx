import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

/** 与全局约定一致：公司上下文只存 selected company，不请求 /companies */
const STORAGE_KEY = 'carbonspeed.companyId'

type CompanyContextValue = {
  companyId: number | null
  setCompanyId: (id: number | null) => void
}

const CompanyContext = createContext<CompanyContextValue | null>(null)

function readStoredCompanyId(): number | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [companyId, setCompanyIdState] = useState<number | null>(readStoredCompanyId)

  const setCompanyId = useCallback((id: number | null) => {
    setCompanyIdState(id)
    try {
      if (id === null) {
        window.localStorage.removeItem(STORAGE_KEY)
      } else {
        window.localStorage.setItem(STORAGE_KEY, String(id))
      }
    } catch {
      // 隐私模式下写入可能被拒绝；上下文内仍保留本次选择
    }
  }, [])

  const value = useMemo(() => ({ companyId, setCompanyId }), [companyId, setCompanyId])

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
}

export function useCompany(): CompanyContextValue {
  const context = useContext(CompanyContext)
  if (!context) {
    throw new Error('useCompany 必须在 CompanyProvider 内使用')
  }
  return context
}

export default CompanyProvider
