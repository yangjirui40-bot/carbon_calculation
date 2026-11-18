import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { reportsApi } from '../../../api'
import type { CalculationRunDetail } from '../../../api/types'
import { SwissButton } from '../../../components/swiss'
import { errorMessage } from '../text'
import './ResultsActions.css'

type ResultsActionsProps = {
  run: CalculationRunDetail
}

/** 结果页操作：返回核算中心、生成 ISO 14064、审计穿透。 */
export default function ResultsActions({ run }: ResultsActionsProps) {
  const navigate = useNavigate()
  const [generating, setGenerating] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const canGenerate = run.operation === 'enterprise' && run.status === 'success'

  async function handleGenerate() {
    if (run.company_id === null) {
      setNotice('缺少企业信息，无法生成 ISO 14064 报告')
      return
    }

    setGenerating(true)
    setNotice(null)
    try {
      const response = await reportsApi.generateIso14064({
        company_id: run.company_id,
        run_id: run.run_id,
      })
      if ('found' in response && response.found === false) {
        setNotice('未找到可用于生成报告的企业核算结果')
        return
      }
      if ('report_no' in response && response.report_no) {
        navigate(`/reports/${response.report_no}`)
        return
      }
      setNotice('报告生成失败：后端未返回报告编号')
    } catch (error) {
      setNotice(errorMessage(error))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="results-actions">
      <SwissButton variant="ghost" onClick={() => navigate('/calculations')}>
        返回核算中心
      </SwissButton>

      {canGenerate ? (
        <SwissButton onClick={handleGenerate} loading={generating}>
          生成 ISO 14064 报告
        </SwissButton>
      ) : null}

      <Link className="results-audit-link" to={`/audit/runs/${run.run_id}`}>
        审计穿透 →
      </Link>

      {notice ? (
        <div className="results-actions__notice" role="alert">
          {notice}
        </div>
      ) : null}
    </div>
  )
}
