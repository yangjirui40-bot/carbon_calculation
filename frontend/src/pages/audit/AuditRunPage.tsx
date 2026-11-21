import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { auditApi } from '../../api'
import type {
  Attestation,
  AttestationQuery,
  AuditTrace,
} from '../../api/types'
import {
  SwissEmpty,
  SwissError,
  SwissMasthead,
  SwissSection,
  SwissStat,
} from '../../components/swiss'
import { EMPTY_VALUE, formatNumber } from '../../utils/format'
import AttestationPanel from './AttestationPanel'
import TraceSections from './TraceSections'
import { errorMessage, operationLabel } from './auditFormat'
import './audit.css'

type ViewStatus = 'loading' | 'notFound' | 'error' | 'ready'

/** 核算穿透与存证：运行摘要、因子/记录/单据/日志，以及哈希存证。 */
export default function AuditRunPage() {
  const [search, setSearch] = useSearchParams()
  const record = search.get('record')
  const { runId } = useParams<{ runId: string }>()
  const [trace, setTrace] = useState<AuditTrace | null>(null)
  const [attestation, setAttestation] = useState<AttestationQuery | null>(null)
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
    Promise.all([auditApi.getTrace(runId), auditApi.getAttestation(runId)])
      .then(([traceResult, attestationResult]) => {
        if (!active) return
        setTrace(traceResult)
        setAttestation(attestationResult)
        setView(traceResult.found ? 'ready' : 'notFound')
      })
      .catch((loadError: unknown) => {
        if (!active) return
        setTrace(null)
        setAttestation(null)
        setError(errorMessage(loadError))
        setView('error')
      })

    return () => {
      active = false
    }
  }, [runId, token])

  const handleAttested = useCallback(
    (result: Attestation) => {
      setAttestation({ ...result, attested: true })
      if (!runId) return
      auditApi
        .getTrace(runId)
        .then((next) => {
          if (next.found) setTrace(next)
        })
        .catch(() => {
          // 存证已成功；时间线刷新失败不影响存证结果展示
        })
    },
    [runId],
  )

  const description =
    view === 'ready' && trace
      ? `运行 ${trace.run_id} · ${operationLabel(trace.operation)}`
      : '查看核算公式、因子清单、明细记录与哈希存证。'

  return (
    <div className="audit-page">
      <SwissMasthead
        kicker="审计 / Trace & Attestation"
        title="核算穿透与存证"
        description={description}
        backTo={{ to: '/audit', label: '审计日志' }}
      />

      {view === 'loading' ? (
        <div className="audit-state audit-state--lead" role="status" aria-busy="true">
          正在加载核算穿透…
        </div>
      ) : null}

      {view === 'notFound' ? (
        <SwissEmpty
          title="找不到这次运行"
          description={
            runId
              ? `运行编号 ${runId} 不存在，或没有可审计的核算结果。`
              : '缺少运行编号，或没有可审计的核算结果。'
          }
          action={
            <Link className="audit-back-link" to="/audit">
              返回审计日志 →
            </Link>
          }
        />
      ) : null}

      {view === 'error' ? (
        <SwissError
          message={error}
          onRetry={() => setToken((value) => value + 1)}
          backTo={{ to: '/audit', label: '返回审计日志' }}
        />
      ) : null}

      {view === 'ready' && trace ? (
        <>
          <SwissSection kicker="Summary" title="运行摘要">
            <div className="audit-summary">
              <div className="audit-summary__stat">
                <SwissStat
                  label="总排放"
                  value={formatNumber(trace.total_kgco2e, 2)}
                  unit="kgCO₂e"
                  hint={
                    typeof trace.total_kgco2e === 'number' &&
                    Math.abs(trace.total_kgco2e) >= 1000
                      ? `约 ${formatNumber(trace.total_kgco2e / 1000, 2)} tCO₂e`
                      : undefined
                  }
                />
              </div>
              <dl className="audit-summary__meta">
                <div>
                  <dt>运行编号</dt>
                  <dd className="audit-mono">{trace.run_id}</dd>
                </div>
                <div>
                  <dt>操作类型</dt>
                  <dd>{operationLabel(trace.operation)}</dd>
                </div>
                <div>
                  <dt>算法版本</dt>
                  <dd className="audit-mono">
                    {trace.algorithm_version || EMPTY_VALUE}
                  </dd>
                </div>
                {trace.lineage && (
                  <div>
                    <dt>核算归档</dt>
                    <dd>
                      {trace.lineage.inputs || trace.lineage.results
                        ? `${trace.lineage.inputs} 条输入 · ${trace.lineage.results} 条结果`
                        : '本次无已归档分录，可查阅已保存快照'}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
            <div className="audit-formula">
              <div className="audit-formula__label">核算公式</div>
              <p className="audit-formula__text">
                {trace.formula || EMPTY_VALUE}
              </p>
            </div>
          </SwissSection>

          <TraceSections trace={trace} selectedRecord={record} onReset={() => setSearch({})} />

          <SwissSection kicker="Attestation" title="哈希存证">
            <AttestationPanel
              runId={trace.run_id}
              attestation={attestation}
              onAttested={handleAttested}
            />
          </SwissSection>
        </>
      ) : null}
    </div>
  )
}
