import { App } from 'antd'
import { useState } from 'react'
import { systemApi } from '../../api'
import { SwissButton, SwissSection } from '../../components/swiss'
import { toErrorMessage } from './errors'

const RESULT_LABELS: Record<string, string> = {
  fact_emission_rows: '事实表 fact_emission 行数',
  fact_company_emission_rows: '汇总事实表 fact_company_emission 行数',
}

/** OLAP 页签：手动全量重建星型模型，展示后端返回的事实表行数 */
export default function OlapPanel() {
  const { modal } = App.useApp()
  const [refreshing, setRefreshing] = useState(false)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleRefresh() {
    modal.confirm({
      title: '重建 OLAP 星型模型？',
      content:
        '将清空并全量重写事实表，维度表按当前企业、期间、类别与供应商更新；重建期间驾驶舱聚合查询会使用新事实表。',
      okText: '开始重建',
      cancelText: '取消',
      rootClassName: 'swiss-confirm',
      centered: true,
      onOk: async () => {
        setRefreshing(true)
        setMessage(null)
        setError(null)
        setResult(null)
        try {
          const data = await systemApi.refreshOlap()
          setResult(data)
          setMessage('OLAP 星型模型已重建完成。')
        } catch (requestError) {
          setError(toErrorMessage(requestError))
        } finally {
          setRefreshing(false)
        }
      },
    })
  }

  const numericEntries = result
    ? Object.entries(result).filter(
        (entry): entry is [string, number] => typeof entry[1] === 'number',
      )
    : []

  return (
    <SwissSection
      kicker="OLAP"
      title="星型模型重建"
      extra={
        <SwissButton onClick={handleRefresh} loading={refreshing}>
          重建 OLAP 模型
        </SwissButton>
      }
    >
      <p className="system-schema-note">
        后端在种子数据或业务记录变更时会自动触发刷新；此处用于手动全量重建并核对事实表行数。
      </p>

      {message ? (
        <div className="system-feedback" role="status">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="system-feedback system-feedback--fail" role="alert">
          {error}
        </div>
      ) : null}

      {result ? (
        numericEntries.length > 0 ? (
          <dl className="system-kv">
            {numericEntries.map(([key, value]) => (
              <div className="system-kv__row" key={key}>
                <dt>{RESULT_LABELS[key] ?? key}</dt>
                <dd>{value.toLocaleString('zh-CN')}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <pre className="system-json">{JSON.stringify(result, null, 2)}</pre>
        )
      ) : null}
    </SwissSection>
  )
}
