import ResearchEstimate from './ResearchEstimate'
import { useState } from 'react'
import { calculationsApi } from '../../api'
import type { EIOLCAResultData, EngineResponse } from '../../api/types'
import { SwissEmpty, SwissMasthead, SwissSection } from '../../components/swiss'
import EiolcaForm, { type EiolcaAmounts } from './swiss/EiolcaForm'
import EiolcaResultPanel from './swiss/EiolcaResultPanel'
import { errorMessage, visibleWarnings } from './labels'
import './EiolcaPage.css'

/** EIO-LCA 核算台：采购金额 → 部门排放贡献。 */
export default function EiolcaPage() {
  const [response, setResponse] = useState<EngineResponse<EIOLCAResultData> | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])

  async function handleSubmit(amounts: EiolcaAmounts) {
    setSubmitting(true)
    setError(null)
    setWarnings([])
    setResponse(null)
    try {
      const result = await calculationsApi.runEiolca({
        purchase_vector_cny: amounts,
      })
      if (result.status === 'success') {
        setResponse(result)
        return
      }
      setResponse(null)
      const nextWarnings = visibleWarnings(result.warnings)
      setWarnings(nextWarnings)
      setError(
        nextWarnings.length > 0
          ? '计算未完成，请查看下方提示'
          : '计算未完成，后端未返回更多信息',
      )
    } catch (submitError) {
      setResponse(null)
      setError(errorMessage(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="eiolca-page">
      <SwissMasthead
        kicker="核算 / EIO-LCA"
        title="EIO-LCA 核算台"
        description="按采购金额与投入产出矩阵计算各部门排放贡献。"
        backTo={{ to: '/calculations', label: '核算中心' }}
      />

      <ResearchEstimate />
      <div className="eiolca-grid">
        <SwissSection kicker="输入" title="采购金额" extra={<span>单位：元</span>}>
          <EiolcaForm loading={submitting} onSubmit={handleSubmit} />
        </SwissSection>

        <SwissSection
          kicker="结果"
          title="部门排放贡献"
          extra={response ? <span>运行 {response.run_id}</span> : undefined}
        >
          {error ? (
            <div className="eiolca-error" role="alert">
              <p>{error}</p>
              {warnings.length > 0 ? (
                <ul>
                  {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : response ? (
            <EiolcaResultPanel response={response} />
          ) : submitting ? (
            <div className="eiolca-loading" role="status" aria-busy="true">
              正在计算部门排放…
            </div>
          ) : (
            <SwissEmpty
              title="尚未发起计算"
              description="填写三类采购金额后提交，这里会显示总排放、部门贡献与矩阵诊断。"
            />
          )}
        </SwissSection>
      </div>
    </div>
  )
}
