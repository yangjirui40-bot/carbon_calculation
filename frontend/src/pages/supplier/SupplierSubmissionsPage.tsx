import dayjs from 'dayjs'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supplierPortalApi } from '../../api'
import type {
  SupplierPortalProfile,
  SupplierSubmissionRecord,
} from '../../api/types'
import PageSkeleton from '../../components/common/PageSkeleton'
import {
  SwissError,
  SwissMasthead,
  SwissSection,
} from '../../components/swiss'
import { requestErrorMessage } from './meta'
import CurrentQuotaPanel from './swiss/CurrentQuotaPanel'
import SubmissionTrend from './swiss/SubmissionTrend'
import SubmissionsTable from './swiss/SubmissionsTable'
import './SupplierSubmissionsPage.css'

type ViewStatus = 'loading' | 'error' | 'ready'

/** 上报历史：上报表、期间趋势与当前配额（非历史配额） */
export default function SupplierSubmissionsPage() {
  const [submissions, setSubmissions] = useState<SupplierSubmissionRecord[]>([])
  const [profile, setProfile] = useState<SupplierPortalProfile | null>(null)
  const [view, setView] = useState<ViewStatus>('loading')
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let active = true
    setView('loading')
    setError('')

    Promise.all([
      supplierPortalApi.listSubmissions(),
      supplierPortalApi.getMe().catch(() => null),
    ] as const)
      .then(([records, me]) => {
        if (!active) return
        setSubmissions(records)
        setProfile(me)
        setView('ready')
      })
      .catch((loadError: unknown) => {
        if (!active) return
        setSubmissions([])
        setProfile(null)
        setError(requestErrorMessage(loadError))
        setView('error')
      })

    return () => {
      active = false
    }
  }, [tick])

  const currentQuota = useMemo(() => {
    if (!profile || profile.quotas.length === 0) return null
    const currentYear = dayjs().year()
    const eligible = profile.quotas.filter((quota) => quota.year <= currentYear)
    const pool = eligible.length > 0 ? eligible : profile.quotas
    return pool.reduce((latest, quota) =>
      quota.year > latest.year ? quota : latest,
    )
  }, [profile])

  return (
    <div className="supplier-submissions-page">
      <SwissMasthead
        kicker="供应商门户 / Submissions"
        title="上报历史"
        description="查看历次上报记录与上报排放量随期间的变化。"
      />

      {view === 'loading' ? <PageSkeleton /> : null}

      {view === 'error' ? (
        <SwissError
          message={error}
          onRetry={() => setTick((value) => value + 1)}
        />
      ) : null}

      {view === 'ready' ? (
        <>
          <SwissSection
            kicker="History"
            title="上报记录"
            extra={<span>共 {submissions.length} 条</span>}
          >
            <SubmissionsTable
              submissions={submissions}
              empty={
                <span>
                  暂无上报记录，先
                  <Link className="submissions-inline-link" to="/supplier/report">
                    去碳数据填报
                  </Link>
                  。
                </span>
              }
            />
          </SwissSection>

          <SwissSection
            kicker="Trend"
            title="期间趋势"
            extra={<span>按期间汇总上报排放量</span>}
          >
            <SubmissionTrend submissions={submissions} />
          </SwissSection>

          {currentQuota ? (
            <SwissSection
              kicker="Quota"
              title="当前配额"
              extra={<span>{currentQuota.year} 年度</span>}
            >
              <CurrentQuotaPanel quota={currentQuota} />
            </SwissSection>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
