import { Link, useNavigate } from 'react-router-dom'
import type { CalculationRunSummary } from '../../../api/types'
import SwissButton from '../../../components/swiss/SwissButton'
import SwissEmpty from '../../../components/swiss/SwissEmpty'
import SwissSection from '../../../components/swiss/SwissSection'
import { formatDateTime, formatEmission } from '../../../utils/format'
import { runStatusLabel, runStatusTone } from './runStatus'
import './RecentRuns.css'

type RecentRunsProps = {
  runs: CalculationRunSummary[]
}

/** 最近 5 次核算；整行通过首列链接跳转到结果页 */
export default function RecentRuns({ runs }: RecentRunsProps) {
  const navigate = useNavigate()
  const rows = runs.slice(0, 5)

  return (
    <SwissSection kicker="History" title="最近企业核算" extra="最新 5 条">
      {rows.length === 0 ? (
        <SwissEmpty
          title="还没有核算记录"
          description="完成一次企业核算后，运行编号、状态与总排放会显示在这里。"
          action={<SwissButton onClick={() => navigate('/calculations')}>去核算</SwissButton>}
        />
      ) : (
        <div className="ws-runs-wrap">
          <table className="ws-runs">
            <thead>
              <tr>
                <th scope="col">运行编号</th>
                <th scope="col">状态</th>
                <th scope="col" className="is-right">
                  总排放 (kgCO₂e)
                </th>
                <th scope="col" className="is-right">
                  时间
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((run) => (
                <tr className="ws-runs__row" key={run.run_id}>
                  <td className="ws-runs__id">
                    <Link
                      className="ws-runs__link"
                      to={`/results/${run.run_id}`}
                      aria-label={`查看核算结果 ${run.run_id}`}
                    >
                      {run.run_id}
                    </Link>
                  </td>
                  <td>
                    <span className={`ws-status ws-status--${runStatusTone(run.status)}`}>
                      {runStatusLabel(run.status)}
                    </span>
                  </td>
                  <td className="is-right num">{formatEmission(run.total_kgco2e)}</td>
                  <td className="is-right">{formatDateTime(run.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SwissSection>
  )
}
