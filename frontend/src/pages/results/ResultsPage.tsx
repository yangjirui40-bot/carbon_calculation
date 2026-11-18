import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiRequestError, calculationsApi } from '../../api'
import type { CalculationRunDetail } from '../../api/types'
import {
  SwissEmpty,
  SwissError,
  SwissMasthead,
  SwissSection,
} from '../../components/swiss'
import { formatDateTime } from '../../utils/format'
import { parseEnterpriseResult } from './enterpriseResult'
import { errorMessage, operationLabel, visibleWarnings } from './text'
import ResultsActions from './swiss/ResultsActions'
import ResultsHero from './swiss/ResultsHero'
import ResultsItems from './swiss/ResultsItems'
import ResultsUncertainty from './swiss/ResultsUncertainty'
import RunMetaList from './swiss/RunMetaList'
import './ResultsPage.css'

type ViewStatus = 'loading' | 'notFound' | 'error' | 'ready'

/** 核算结果：企业结果完整展示，其余操作只给元数据与归属提示。 */
export default function ResultsPage() {
  const { runId } = useParams<{ runId: string }>()
  const [run, setRun] = useState<CalculationRunDetail | null>(null)
  const [view, setView] = useState<ViewStatus>('loading')
  const [error, setError] = useState('')
  const [token, setToken] = useState(0)

  useEffect(() => {
    if (!runId) {
      setView('notFound')
      return
    }

    let active = true
    setView('loading')
    setError('')
    calculationsApi
      .getRun(runId)
      .then((detail) => {
        if (!active) return
        setRun(detail)
        setView('ready')
      })
      .catch((loadError: unknown) => {
        if (!active) return
        if (loadError instanceof ApiRequestError && loadError.status === 404) {
          setRun(null)
          setView('notFound')
          return
        }
        setRun(null)
        setError(errorMessage(loadError))
        setView('error')
      })

    return () => {
      active = false
    }
  }, [runId, token])

  const enterpriseResult = useMemo(
    () =>
      run && run.operation === 'enterprise'
        ? parseEnterpriseResult(run.result)
        : null,
    [run],
  )

  const warnings = visibleWarnings(run?.warnings)

  const description =
    view === 'ready' && run
      ? `运行 ${run.run_id} · ${operationLabel(run.operation)} · ${formatDateTime(run.created_at)}`
      : '查看核算总排放、Scope 构成与明细。'

  return (
    <div className="results-page">
      <SwissMasthead
        kicker="核算 / Results"
        title="核算结果"
        description={description}
        backTo={{ to: '/calculations', label: '核算中心' }}
        actions={
          run && run.operation === 'enterprise' ? (
            <ResultsActions run={run} />
          ) : undefined
        }
      />

      {view === 'loading' ? (
        <div className="results-state" role="status" aria-busy="true">
          正在加载核算结果…
        </div>
      ) : null}

      {view === 'notFound' ? (
        <SwissEmpty
          title="找不到这次核算"
          description="运行编号不存在，或结果还没有生成。"
          action={
            <Link className="results-back-link" to="/calculations">
              返回核算中心 →
            </Link>
          }
        />
      ) : null}

      {view === 'error' ? (
        <SwissError
          message={error}
          onRetry={() => setToken((value) => value + 1)}
          backTo={{ to: '/calculations', label: '返回核算中心' }}
        />
      ) : null}

      {view === 'ready' && run ? (
        run.status === 'error' ? (
          <>
            <SwissSection kicker="运行失败" title="核算未完成">
              <p className="results-failure">
                {run.error_message || '后端未返回错误信息'}
              </p>
              {warnings.length > 0 ? (
                <ul className="results-warnings">
                  {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : null}
            </SwissSection>
            <SwissSection kicker="运行信息" title="任务元数据">
              <RunMetaList run={run} />
            </SwissSection>
          </>
        ) : run.operation !== 'enterprise' ? (
          <>
            <SwissSection kicker="运行结果" title="非企业核算">
              <p className="results-foreign">该结果请在对应模块查看。</p>
              <p className="results-foreign-note">
                本次运行为{operationLabel(run.operation)}，企业结果页只展示
                Scope 1/2/3 核算明细。
              </p>
            </SwissSection>
            <SwissSection kicker="运行信息" title="任务元数据">
              <RunMetaList run={run} />
            </SwissSection>
          </>
        ) : enterpriseResult === null ? (
          <>
            <SwissSection kicker="运行结果" title="结果数据不完整">
              <p className="results-failure">
                后端未返回可展示的企业核算结果。
              </p>
              {warnings.length > 0 ? (
                <ul className="results-warnings">
                  {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : null}
            </SwissSection>
            <SwissSection kicker="运行信息" title="任务元数据">
              <RunMetaList run={run} />
            </SwissSection>
          </>
        ) : (
          <>
            <ResultsHero run={run} result={enterpriseResult} />

            <SwissSection
              kicker="明细"
              title="核算明细"
              extra={<span>{enterpriseResult.items.length} 条记录</span>}
            >
              <ResultsItems items={enterpriseResult.items} />
            </SwissSection>

            {warnings.length > 0 ? (
              <SwissSection kicker="提示" title="运行提示">
                <ul className="results-warnings">
                  {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </SwissSection>
            ) : null}

            <ResultsUncertainty runId={run.run_id} />
          </>
        )
      ) : null}
    </div>
  )
}
