import { useState } from 'react'
import { DownloadOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { download } from '../../api/client'
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
import SupplyHeatmap from './SupplyHeatmap'
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

  const [period, setPeriod] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [downloading, setDownloading] = useState(false)
  const [exportError, setExportError] = useState('')
  const [tier, setTier] = useState('')
  const [industry, setIndustry] = useState('')
  const [region, setRegion] = useState('')
  const [risk, setRisk] = useState('')
  const [selectedId, selectSupplier] = useState<string|null>(null)
  const supplierNodes = data?.heatmap.nodes.filter((node) => node.type !== 'company') ?? []
  const visible = supplierNodes.filter((node) => (
    (!tier || String(node.tier) === tier) && (!industry || node.industry === industry)
    && (!region || node.region === region) && (!risk || node.risk_level === risk)
  ))
  const missing = supplierNodes.filter((node) => node.propagated_intensity === null).length
  const estimated = supplierNodes.filter((node) => node.estimated && node.propagated_intensity !== null).length
  const suppliersWithReports = supplierNodes.filter((node) => node.carbon_intensity != null).length
  const visibleIds = new Set(visible.map((node) => node.id))

  function downloadSnapshot() {
    if (!data) return
    const blob = new Blob([JSON.stringify({
      exported_at: new Date().toISOString(),
      report: data.report,
      method: '企业填报与邻接估算，供内部供应链筛查',
      nodes: supplierNodes,
      relationships: data.network.edges,
    }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `供应链快照-${data.report.company_id}-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 3000)
  }

  async function downloadDisclosure() {
    const companyId = scope.effectiveCompanyId
    if (companyId == null || !period || downloading) return
    setDownloading(true)
    setExportError('')
    try {
      const blob = await download({
        url: `/api/v1/supply-chain/${companyId}/report.xlsx`, params: { period },
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `供应链披露工作底稿-${period}.xlsx`
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 3000)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : '导出失败，请重试。')
    } finally {
      setDownloading(false)
    }
  }

  const supplierCount = data?.report.supplier_count ?? 0
  const statistics = data?.heatmap.statistics

  return (
    <div className="sc-page">
      <SwissMasthead
        kicker="协同 / Supply Chain"
        title="供应链碳管理"
        description="检查各层级供应商的填报覆盖、风险热点、内部配额和减排计划。"
        actions={data ? <button className="sc-export-button" type="button" onClick={downloadSnapshot}><DownloadOutlined /> 导出供应链快照</button> : undefined}
      />
      <SupplyChainSubnav />
      {data && <form className="sc-disclosure" onSubmit={(event) => {
        event.preventDefault()
        void downloadDisclosure()
      }}>
        <label htmlFor="disclosure-month">披露期间</label>
        <input type="month" id="disclosure-month" required value={period} onChange={(event) => setPeriod(event.target.value)} />
        <button className="sc-export-button" type="submit" disabled={downloading || !period}>
          <DownloadOutlined /> {downloading ? '正在生成…' : '导出披露工作底稿'}
        </button>
        {exportError && <p role="alert">{exportError}</p>}
      </form>}

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
          <div className="sc-coverage">
            <span><b>{supplierCount}</b> 供应商</span>
            <span><b>{suppliersWithReports}</b> 有填报强度</span>
            <span><b>{estimated}</b> 邻接估算</span>
            <span><b>{missing}</b> 缺数据</span>
          </div>
          <div className="sc-filters" aria-label="供应商分析筛选">
            <label>层级 <select value={tier} onChange={(event) => setTier(event.target.value)}><option value="">全部</option>{[...new Set(supplierNodes.map((node) => node.tier))].sort().map((value) => <option key={value} value={value}>{value} 级供应商</option>)}</select></label>
            <label>行业 <select value={industry} onChange={(event) => setIndustry(event.target.value)}><option value="">全部</option>{[...new Set(supplierNodes.map((node) => node.industry).filter(Boolean))].sort().map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label>地区 <select value={region} onChange={(event) => setRegion(event.target.value)}><option value="">全部</option>{[...new Set(supplierNodes.map((node) => node.region).filter(Boolean))].sort().map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label>风险 <select value={risk} onChange={(event) => setRisk(event.target.value)}><option value="">全部</option><option value="red">高风险</option><option value="yellow">中风险</option><option value="green">低风险</option><option value="unknown">缺数据</option></select></label>
            <span>{visible.length} 家符合条件</span>
          </div>
          <SupplyHeatmap key={JSON.stringify([scope.effectiveCompanyId,tier,industry,region,risk])} companyId={scope.effectiveCompanyId} nodes={visible}
            thresholds={data.heatmap.thresholds} selectedId={selectedId} onSelect={selectSupplier} />
          <SwissSection
            kicker="Topology"
            title="网络拓扑"
            extra={
              <span>
                筛选后节点 {visible.length} 家
                {loading ? ' · 正在刷新' : ''}
              </span>
            }
          >
            <NetworkGraph
              onSelect={selectSupplier}
              network={{ ...data.network,
                nodes: data.network.nodes.filter((node) => node.type === 'company' || visibleIds.has(node.id)),
                edges: data.network.edges.filter((edge) => [edge.source_id, edge.target_id].every((id) => visibleIds.has(id) || data.network.nodes.some((node) => node.id === id && node.type === 'company'))),
              }}
              heatmap={{ ...data.heatmap, nodes: visible }} />
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
              供应商以填报强度着色。缺报节点在有邻接数据时展示估算，否则显示未知。风险用于内部筛查。
            </p>
          </SwissSection>

          <div className="sc-overview-grid">
            <SwissSection
              kicker="Heatmap"
              title="供应商碳强度明细"
              extra={<span>传播碳强度 · {INTENSITY_UNIT}</span>}
            >
              <HeatmapTable nodes={visible} />
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
