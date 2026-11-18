import { useEffect, useState } from 'react'
import { supplierPortalApi } from '../../api'
import type { SupplierPortalProfile } from '../../api/types'
import PageSkeleton from '../../components/common/PageSkeleton'
import {
  SwissError,
  SwissMasthead,
  SwissSection,
} from '../../components/swiss'
import { requestErrorMessage } from './meta'
import PortalShortcuts from './swiss/PortalShortcuts'
import QuotaTable from './swiss/QuotaTable'
import ReductionPlanTable from './swiss/ReductionPlanTable'
import SupplierProfilePanel from './swiss/SupplierProfilePanel'
import './SupplierHomePage.css'

type ViewStatus = 'loading' | 'error' | 'ready'

/** 供应商门户首页：档案、配额、减排计划与快捷入口 */
export default function SupplierHomePage() {
  const [profile, setProfile] = useState<SupplierPortalProfile | null>(null)
  const [view, setView] = useState<ViewStatus>('loading')
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let active = true
    setView('loading')
    setError('')

    supplierPortalApi
      .getMe()
      .then((data) => {
        if (!active) return
        setProfile(data)
        setView('ready')
      })
      .catch((loadError: unknown) => {
        if (!active) return
        setProfile(null)
        setError(requestErrorMessage(loadError))
        setView('error')
      })

    return () => {
      active = false
    }
  }, [tick])

  return (
    <div className="supplier-home-page">
      <SwissMasthead
        kicker="供应商门户 / Supplier"
        title="门户首页"
        description="查看供应商档案、碳强度、风险与配额。"
      />

      {view === 'loading' ? <PageSkeleton /> : null}

      {view === 'error' ? (
        <SwissError
          message={error}
          onRetry={() => setTick((value) => value + 1)}
        />
      ) : null}

      {view === 'ready' && profile ? (
        <>
          <SwissSection kicker="Profile" title="供应商档案">
            <SupplierProfilePanel profile={profile} />
          </SwissSection>

          <SwissSection
            kicker="Quota"
            title="配额"
            extra={<span>{profile.quotas.length} 个年度</span>}
          >
            <QuotaTable quotas={profile.quotas} />
          </SwissSection>

          <SwissSection
            kicker="Reduction"
            title="减排计划"
            extra={<span>{profile.reduction_plans.length} 项计划</span>}
          >
            <ReductionPlanTable plans={profile.reduction_plans} />
          </SwissSection>

          <SwissSection kicker="Shortcuts" title="快捷入口">
            <PortalShortcuts />
          </SwissSection>
        </>
      ) : null}
    </div>
  )
}
