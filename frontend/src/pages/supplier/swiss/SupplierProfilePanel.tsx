import type { SupplierPortalProfile } from '../../../api/types'
import { SwissStat } from '../../../components/swiss'
import { formatNumber } from '../../../utils/format'
import { riskMeta, tierLabel } from '../meta'
import './SupplierProfilePanel.css'

type SupplierProfilePanelProps = {
  profile: SupplierPortalProfile
}

/** 供应商档案：名称、编号、行业、地区、层级、碳强度、年排放与风险等级 */
export default function SupplierProfilePanel({ profile }: SupplierProfilePanelProps) {
  const risk = riskMeta(profile.risk_level)

  return (
    <div className="supplier-profile">
      <div className="supplier-profile__identity">
        <h2 className="supplier-profile__name">{profile.name}</h2>
        <div className="supplier-profile__meta">
          <span className="supplier-profile__id num">{profile.supplier_id}</span>
          <span>{tierLabel(profile.tier)}</span>
          <span>{profile.industry ?? '行业未录入'}</span>
          <span>{profile.region ?? '地区未录入'}</span>
        </div>
        <div className="supplier-profile__risk">
          <span className="supplier-profile__risk-label">风险等级</span>
          <span className={`risk-chip risk-chip--${risk.tone}`}>
            <span className="risk-chip__dot" aria-hidden="true" />
            {risk.label}
          </span>
        </div>
      </div>

      <div className="supplier-profile__stats">
        <SwissStat
          label="碳强度"
          value={formatNumber(profile.carbon_intensity, 2)}
          unit="kgCO₂e/元"
        />
        <SwissStat
          label="年排放"
          value={formatNumber(profile.annual_emissions, 2)}
          unit="kgCO₂e"
        />
      </div>
    </div>
  )
}
