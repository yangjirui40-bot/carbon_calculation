import { App } from 'antd'
import { useState } from 'react'
import type { QuotaTrade } from '../../api/types'
import { supplyChainApi } from '../../api'
import {
  SwissButton,
  SwissEmpty,
  SwissError,
  SwissMasthead,
  SwissSection,
} from '../../components/swiss'
import { formatNumber } from '../../utils/format'
import CompanyBar from './CompanyBar'
import SupplyChainSubnav from './SupplyChainSubnav'
import TradeCreateDrawer from './TradeCreateDrawer'
import TradeSummary from './TradeSummary'
import TradeTable, { TRADE_UNITS } from './TradeTable'
import { QUOTA_UNIT, companyNameById } from './constants'
import { errorText } from './errors'
import { useSupplyChainCompany } from './useSupplyChainCompany'
import { useTradesData } from './useTradesData'
import './shared.css'
import './TradesPage.css'

/** 配额交易与对账：摘要、明细、发起与买方确认 */
export default function TradesPage() {
  const { modal, message } = App.useApp()
  const scope = useSupplyChainCompany()
  const companyId = scope.effectiveCompanyId
  const { trades, reconciliation, companies, loading, error, reload } =
    useTradesData(companyId)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [actingId, setActingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const buyerCount = companies.filter((company) => company.id !== companyId).length
  const sellerName = companyNameById(companies, companyId)
  const onlyOneCompany = companyId !== null && companies.length > 0 && buyerCount === 0

  async function runTradeAction(
    trade: QuotaTrade,
    action: 'accept' | 'decline',
  ) {
    setActingId(trade.trade_id)
    setActionError(null)
    try {
      if (action === 'accept') {
        await supplyChainApi.acceptTrade(trade.trade_id)
        message.success('交易已接受')
      } else {
        await supplyChainApi.declineTrade(trade.trade_id)
        message.success('交易已拒绝')
      }
      reload()
    } catch (err) {
      setActionError(errorText(err))
    } finally {
      setActingId(null)
    }
  }

  function confirmAccept(trade: QuotaTrade) {
    modal.confirm({
      title: '接受这笔配额交易？',
      content: `接受后将按 ${trade.year} 年划转 ${formatNumber(trade.amount, 2)} ${QUOTA_UNIT}，操作不可撤销。`,
      okText: '确认接受',
      cancelText: '取消',
      rootClassName: 'swiss-confirm',
      centered: true,
      onOk: () => runTradeAction(trade, 'accept'),
    })
  }

  function confirmDecline(trade: QuotaTrade) {
    modal.confirm({
      title: '拒绝这笔配额交易？',
      content: '拒绝后交易不会划转配额，状态将变为已拒绝。',
      okText: '确认拒绝',
      cancelText: '取消',
      rootClassName: 'swiss-confirm',
      centered: true,
      okButtonProps: { danger: true },
      onOk: () => runTradeAction(trade, 'decline'),
    })
  }

  const contentReady = companyId !== null && !scope.unbound

  return (
    <div className="sc-page">
      <SwissMasthead
        kicker="协同 / Trades"
        title="配额交易与对账"
        description="发起跨企业配额交易，买方确认后自动划转配额并生成对账摘要。"
        actions={
          scope.canWrite ? (
            <SwissButton
              onClick={() => setDrawerOpen(true)}
              disabled={!contentReady || buyerCount === 0}
              title={
                companies.length > 0 && buyerCount === 0
                  ? '当前只有一家企业，无法发起跨企业交易'
                  : undefined
              }
            >
              发起交易
            </SwissButton>
          ) : undefined
        }
      />
      <SupplyChainSubnav />

      {scope.pickerVisible ? (
        <CompanyBar
          companies={scope.companies}
          value={companyId}
          loading={scope.pickerLoading}
          error={scope.pickerError}
          onChange={(id) => {
            setActionError(null)
            setDrawerOpen(false)
            scope.selectCompany(id)
          }}
          onRetry={scope.reloadCompanies}
        />
      ) : null}

      {scope.unbound ? (
        <SwissError
          message="当前账号未绑定企业，无法查看配额交易。请联系管理员。"
          backTo={{ to: '/workspace', label: '返回工作台' }}
        />
      ) : companyId === null ? (
        <SwissEmpty
          title="请选择企业"
          description="管理员与审计员需先在上方选择企业，再查看该企业的配额交易与对账。"
        />
      ) : error ? (
        <SwissError message={error} onRetry={reload} />
      ) : loading && reconciliation === null ? (
        <div className="sc-state" role="status">
          正在加载配额交易…
        </div>
      ) : (
        <>
          {onlyOneCompany ? (
            <div className="sc-notice" role="status">
              当前只有一家企业，无法发起跨企业交易。交易功能需要至少两家企业参与。
            </div>
          ) : null}

          <SwissSection
            kicker="Reconciliation"
            title="对账摘要"
            extra={<span>企业：{sellerName}</span>}
          >
            {reconciliation ? (
              <TradeSummary summary={reconciliation.summary} />
            ) : (
              <div className="sc-state" role="status">
                暂无对账数据
              </div>
            )}
          </SwissSection>

          <SwissSection
            kicker="Trades"
            title="交易记录"
            extra={
              <span>
                {loading ? '正在刷新…' : `共 ${trades.length} 条`} · {TRADE_UNITS}
              </span>
            }
          >
            {actionError ? (
              <div className="sc-feedback sc-feedback--fail" role="alert">
                {actionError}
              </div>
            ) : null}

            {trades.length === 0 ? (
              <SwissEmpty
                title="还没有配额交易"
                description={
                  onlyOneCompany
                    ? '当前只有一家企业，无法发起跨企业交易。'
                    : '发起交易后，买方接受即完成配额划转与资金结算。'
                }
                action={
                  scope.canWrite && buyerCount > 0 ? (
                    <SwissButton onClick={() => setDrawerOpen(true)}>发起交易</SwissButton>
                  ) : undefined
                }
              />
            ) : (
              <TradeTable
                trades={trades}
                companies={companies}
                companyId={companyId}
                canWrite={scope.canWrite}
                actingId={actingId}
                onAccept={confirmAccept}
                onDecline={confirmDecline}
              />
            )}
          </SwissSection>
        </>
      )}

      <TradeCreateDrawer
        open={drawerOpen}
        companyId={companyId}
        sellerName={sellerName}
        companies={companies}
        onClose={() => setDrawerOpen(false)}
        onCreated={() => {
          setDrawerOpen(false)
          message.success('交易已发起，等待买方确认')
          reload()
        }}
      />
    </div>
  )
}
