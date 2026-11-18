import type { CompanyDetail, QuotaTrade } from '../../api/types'
import SwissButton from '../../components/swiss/SwissButton'
import SwissTable, {
  type SwissTableColumn,
} from '../../components/swiss/SwissTable'
import { formatDateTime, formatNumber } from '../../utils/format'
import StatusText from './StatusText'
import {
  PRICE_UNIT,
  QUOTA_UNIT,
  companyNameById,
  tradeStatusLabel,
  tradeStatusTone,
} from './constants'
import './shared.css'

const COLUMNS: SwissTableColumn[] = [
  { key: 'trade_id', title: '交易编号', width: 148 },
  { key: 'seller', title: '卖方企业' },
  { key: 'buyer', title: '买方企业' },
  { key: 'year', title: '年份', width: 70, align: 'right' },
  { key: 'amount', title: '数量', width: 104, align: 'right' },
  { key: 'price', title: '单价', width: 104, align: 'right' },
  { key: 'status', title: '状态', width: 82 },
  { key: 'created_at', title: '时间', width: 132 },
  { key: 'actions', title: '操作', width: 132, align: 'right' },
]

type TradeTableProps = {
  trades: QuotaTrade[]
  companies: CompanyDetail[]
  companyId: number
  canWrite: boolean
  actingId: string | null
  onAccept: (trade: QuotaTrade) => void
  onDecline: (trade: QuotaTrade) => void
}

/** 交易表：仅当前企业为买方且状态 pending 时提供接受 / 拒绝 */
export default function TradeTable({
  trades,
  companies,
  companyId,
  canWrite,
  actingId,
  onAccept,
  onDecline,
}: TradeTableProps) {
  const rows = trades.map((trade) => {
    const actionable =
      canWrite && trade.status === 'pending' && trade.buyer_company_id === companyId
    return {
      _key: trade.trade_id,
      trade_id: <span className="sc-cell-id">{trade.trade_id}</span>,
      seller: companyNameById(companies, trade.seller_company_id),
      buyer: companyNameById(companies, trade.buyer_company_id),
      year: <span className="num">{trade.year}</span>,
      amount: <span className="num">{formatNumber(trade.amount, 2)}</span>,
      price: <span className="num">{formatNumber(trade.price, 2)}</span>,
      status: (
        <StatusText tone={tradeStatusTone(trade.status)}>
          {tradeStatusLabel(trade.status)}
        </StatusText>
      ),
      created_at: <span className="num">{formatDateTime(trade.created_at)}</span>,
      actions: actionable ? (
        <div className="sc-row-actions">
          <SwissButton
            variant="ghost"
            onClick={() => onAccept(trade)}
            disabled={actingId !== null}
            aria-label={`接受交易 ${trade.trade_id}`}
          >
            接受
          </SwissButton>
          <SwissButton
            variant="danger"
            onClick={() => onDecline(trade)}
            disabled={actingId !== null}
            aria-label={`拒绝交易 ${trade.trade_id}`}
          >
            拒绝
          </SwissButton>
        </div>
      ) : (
        '—'
      ),
    }
  })

  return (
    <SwissTable
      columns={COLUMNS}
      rows={rows}
      rowKey={(row) => String(row._key)}
      empty="暂无配额交易"
    />
  )
}

/** 表头单位提示（文案用于 section extra） */
export const TRADE_UNITS = `${QUOTA_UNIT} · ${PRICE_UNIT}`
