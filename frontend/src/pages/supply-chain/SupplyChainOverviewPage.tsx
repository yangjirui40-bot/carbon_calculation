import { Link } from 'react-router-dom'
import {
  SwissEmpty,
  SwissError,
  SwissMasthead,
  SwissSection,
  SwissStat,
} from '../../components/swiss'
import { formatNumber } from '../../utils/format'
import CompanyBar from './CompanyBar'
import EdgeCreateForm from './EdgeCreateForm'
import HeatmapTable from './HeatmapTable'
import NetworkGraph from './NetworkGraph'
import RiskBadge from './RiskBadge'
import SupplyChainSubnav from './SupplyChainSubnav'
import { INTENSITY_UNIT } from './constants'
import { useOverviewData } from './useOverviewData'
import { useSupplyChainCompany } from './useSupplyChainCompany'
import './shared.css'
import './SupplyChainOverviewPage.css'

/** 供应链总览：网络拓扑、热力节点、风险统计与关系边维护 */
export default function SupplyChainOverviewPage() {
  const scope = useSupplyChainCompany()
  const { data, loading, error, reload } = useOverviewData(scope.effectiveCompanyId)

  const supplierCount = data?.report.supplier_count ?? 0
  const statistics = data?.heatmap.statistics

  return (
    <div className="sc-page">
      <SwissMasthead
        kicker="协同 / Supply Chain"
        title="供应链总览"
        description="查看供应链网络拓扑、传播碳强度与风险热点；关系数据按所选企业隔离。"
      />
      <SupplyChainSubnav />

      {scope.pickerVisible ? (
        <CompanyBar
          companies={scope.companies}
          value={scope.effectiveCompanyId}
          loading={scope.pickerLoading}
          error={scope.pickerError}
          onChange={scope.selectCompany}
          onRetry={scope.reloadCompanies}
        />
      ) : null}

      {scope.unbound ? (
        <SwissError
          message="当前账号未绑定企业，无法查看供应链数据。请联系管理员。"
          backTo={{ to: '/workspace', label: '返回工作台' }}
        />
      ) : scope.effectiveCompanyId === null ? (
        <SwissEmpty
          title="请选择企业"
          description="管理员与审计员需先在上方选择企业，再查看该企业的供应链拓扑与风险。"
        />
      ) : error ? (
        <SwissError message={error} onRetry={reload} />
      ) : loading && !data ? (
        <div className="sc-state" role="status">
          正在加载供应链数据…
        </div>
      ) : !data ? null : supplierCount === 0 ? (
        <SwissEmpty
          title="还没有供应商"
          description="当前企业尚未建立供应商档案。先录入供应商，再在总览中维护关系边并查看风险传播。"
          action={
            <Link className="sc-link-button" to="/supply-chain/suppliers">
              前往供应商档案
            </Link>
          }
        />
      ) : (
        <>
          <SwissSection
            kicker="Topology"
            title="网络拓扑"
            extra={
              <span>
                节点 {data.network.nodes.length} · 关系 {data.network.edges.length}
                {loading ? ' · 正在刷新' : ''}
              </span>
            }
          >
            <NetworkGraph network={data.network} heatmap={data.heatmap} />
            <div className="sc-legend" aria-label="图例">
              <span className="sc-legend__item">
                <span className="sc-legend__swatch sc-legend__swatch--company" aria-hidden="true" />
                本企业
              </span>
              <span className="sc-legend__item">
                <RiskBadge level="red" />
              </span>
              <span className="sc-legend__item">
                <RiskBadge level="yellow" />
              </span>
              <span className="sc-legend__item">
                <RiskBadge level="green" />
              </span>
            </div>
            <p className="sc-topology-note">
              本企业节点用深绿标识，供应商按图传播后的碳强度风险着色；二、三级供应商未填报时，
              强度由邻居聚合估算。节点可拖动，悬停查看传播强度与风险。
            </p>
          </SwissSection>

          <div className="sc-overview-grid">
            <SwissSection
              kicker="Heatmap"
              title="热力节点"
              extra={<span>传播碳强度 · {INTENSITY_UNIT}</span>}
            >
              <HeatmapTable nodes={data.heatmap.nodes} />
            </SwissSection>

            <div className="sc-overview-side">
              <SwissSection kicker="Risk" title="风险统计" extra="按节点计数">
                <div className="sc-stat-grid">
                  <SwissStat
                    label="高风险"
                    value={statistics?.red ?? 0}
                    unit="个节点"
                    tone="fail"
                  />
                  <SwissStat
                    label="中风险"
                    value={statistics?.yellow ?? 0}
                    unit="个节点"
                    tone="warn"
                  />
                  <SwissStat
                    label="低风险"
                    value={statistics?.green ?? 0}
                    unit="个节点"
                    tone="accent"
                  />
                </div>
              </SwissSection>

              <SwissSection kicker="Summary" title="报告摘要" extra="供应链报告实时汇总">
                <div className="sc-summary-grid">
                  <SwissStat
                    label="供应商"
                    value={data.report.supplier_count}
                    unit="家"
                    hint="不含本企业节点"
                  />
                  <SwissStat
                    label="风险热点"
                    value={data.report.hot_spots.length}
                    unit="个"
                    hint="红 / 黄风险节点"
                  />
                  <SwissStat
                    label="配额记录"
                    value={data.report.quotas.length}
                    unit="条"
                    hint="当年与历史年份合计"
                  />
                  <SwissStat
                    label="减排计划"
                    value={data.report.reduction_plans.length}
                    unit="项"
                  />
                </div>
                <p className="sc-topology-note">
                  配额合计剩余{' '}
                  <span className="num">
                    {formatNumber(
                      data.report.quotas.reduce((sum, quota) => sum + quota.remaining, 0),
                      2,
                    )}
                  </span>{' '}
                  kgCO₂e。
                </p>
              </SwissSection>
            </div>
          </div>

          {scope.canWrite ? (
            <SwissSection
              kicker="Edge"
              title="新增关系边"
              extra="来源与去向需不同"
            >
              <EdgeCreateForm
                key={scope.effectiveCompanyId}
                nodes={data.network.nodes}
                onCreated={reload}
              />
            </SwissSection>
          ) : null}
        </>
      )}
    </div>
  )
}
