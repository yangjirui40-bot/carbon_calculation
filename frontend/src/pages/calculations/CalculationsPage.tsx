import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { calculationsApi, factorsApi } from '../../api'
import type { CalculationRunSummary } from '../../api/types'
import { readSession } from '../../api/modules/auth'
import {
  SwissButton,
  SwissEmpty,
  SwissMasthead,
  SwissSection,
} from '../../components/swiss'
import CompanyPicker from './swiss/CompanyPicker'
import EnterpriseRunForm from './swiss/EnterpriseRunForm'
import RunHistoryTable from './swiss/RunHistoryTable'
import { useCompanyScope } from './useCompanyScope'
import { errorMessage } from './labels'
import './CalculationsPage.css'

/** 核算中心：发起企业核算 + 全部运行历史。 */
export default function CalculationsPage() {
  const navigate = useNavigate()
  const {
    effectiveCompanyId,
    pickerVisible,
    companies,
    pickerLoading,
    pickerError,
    selectCompany,
    reloadCompanies,
  } = useCompanyScope()

  const role = readSession()?.user.role ?? null
  const canRun = role === 'admin' || role === 'enterprise'
  const canViewAllRuns = role === 'admin' || role === 'auditor'

  const [runs, setRuns] = useState<CalculationRunSummary[]>([])
  const [runsLoading, setRunsLoading] = useState(true)
  const [runsError, setRunsError] = useState<string | null>(null)
  const [runsToken, setRunsToken] = useState(0)

  const reloadRuns = useCallback(() => {
    setRunsToken((token) => token + 1)
  }, [])

  useEffect(() => {
    // 未绑定企业的非管理角色不请求全量历史（后端 cid=None 时不过滤租户）
    if (effectiveCompanyId === null && !canViewAllRuns) {
      setRuns([])
      setRunsLoading(false)
      setRunsError(null)
      return
    }

    let active = true
    setRunsLoading(true)
    setRunsError(null)
    calculationsApi
      .listRuns(effectiveCompanyId === null ? {} : { company_id: effectiveCompanyId })
      .then((list) => {
        if (active) setRuns(list)
      })
      .catch((error: unknown) => {
        if (active) {
          setRuns([])
          setRunsError(errorMessage(error))
        }
      })
      .finally(() => {
        if (active) setRunsLoading(false)
      })

    return () => {
      active = false
    }
  }, [effectiveCompanyId, canViewAllRuns, runsToken])

  const [factorSets, setFactorSets] = useState<string[] | null>(null)
  const [factorSetsError, setFactorSetsError] = useState<string | null>(null)
  const [factorSetsToken, setFactorSetsToken] = useState(0)

  useEffect(() => {
    let active = true
    setFactorSets(null)
    setFactorSetsError(null)
    factorsApi
      .listFactorSets()
      .then((response) => {
        if (active) setFactorSets(Object.keys(response.sets))
      })
      .catch((error: unknown) => {
        if (active) setFactorSetsError(errorMessage(error))
      })

    return () => {
      active = false
    }
  }, [factorSetsToken])

  const reloadFactorSets = useCallback(() => {
    setFactorSetsToken((token) => token + 1)
  }, [])

  return (
    <div className="calc-page">
      <SwissMasthead
        kicker="核算 / Calculations"
        title="核算中心"
        description="发起企业 Scope 1/2/3 核算，并查看全部运行历史。"
        actions={
          <SwissButton variant="ghost" onClick={() => navigate('/calculations/eiolca')}>
            EIO-LCA 核算台
          </SwissButton>
        }
      />

      {pickerVisible ? (
        <div className="calc-company">
          <CompanyPicker
            companies={companies}
            value={effectiveCompanyId}
            loading={pickerLoading}
            error={pickerError}
            onChange={selectCompany}
            onRetry={reloadCompanies}
          />
        </div>
      ) : null}

      <div className="calc-grid">
        <SwissSection
          kicker="发起核算"
          title="企业核算"
          extra={<span>Scope 1 / 2 / 3</span>}
        >
          <EnterpriseRunForm
            companyId={effectiveCompanyId}
            canRun={canRun}
            factorSets={factorSets}
            factorSetsError={factorSetsError}
            onRetryFactorSets={reloadFactorSets}
            onSuccess={(runId) => navigate(`/results/${runId}`)}
          />
        </SwissSection>

        <SwissSection
          kicker="运行历史"
          title="历史任务"
          extra={
            <span>
              {runsLoading ? '加载中' : `共 ${runs.length} 条`}
              {effectiveCompanyId === null && canViewAllRuns ? ' · 全部企业' : ''}
            </span>
          }
        >
          {effectiveCompanyId === null && !canViewAllRuns ? (
            <SwissEmpty
              title="当前账号未绑定企业"
              description="请联系管理员绑定企业后，再发起核算或查看运行历史。"
            />
          ) : (
            <RunHistoryTable
              runs={runs}
              loading={runsLoading}
              error={runsError}
              onRetry={reloadRuns}
            />
          )}
        </SwissSection>
      </div>
    </div>
  )
}
