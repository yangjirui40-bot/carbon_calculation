import { useCallback, useEffect, useState } from 'react'
import { systemApi } from '../../api'
import type { SchemaInfoResponse } from '../../api/types'
import { SwissError, SwissSection, SwissStat } from '../../components/swiss'
import { toErrorMessage } from './errors'

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function TableList({ title, tables }: { title: string; tables: string[] }) {
  return (
    <div className="system-table-list">
      <div className="system-table-list__head">
        {title}（{tables.length}）
      </div>
      {tables.length === 0 ? (
        <div className="system-state">后端没有返回表清单。</div>
      ) : (
        <ul>
          {tables.map((table) => (
            <li key={table}>{table}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** 数据模型：OLTP 3NF 与 OLAP 星型的说明、表清单与 ETL 入口 */
export default function SchemaPanel() {
  const [data, setData] = useState<SchemaInfoResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    systemApi
      .getSchemaInfo()
      .then((info) => {
        if (!active) return
        setData(info)
        setLoading(false)
      })
      .catch((requestError: unknown) => {
        if (!active) return
        setData(null)
        setError(toErrorMessage(requestError))
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [reloadKey])

  const reload = useCallback(() => setReloadKey((key) => key + 1), [])

  const modeling = data ? asRecord(data.modeling) : null
  const oltp = modeling ? asRecord(modeling.OLTP) : null
  const olap = modeling ? asRecord(modeling.OLAP) : null

  if (error || loading || !modeling) {
    return (
      <SwissSection kicker="Model" title="数据模型">
        {error ? (
          <SwissError message={error} onRetry={reload} />
        ) : loading ? (
          <div className="system-state" role="status">
            正在读取数据模型…
          </div>
        ) : (
          <div className="system-state">后端没有返回建模说明。</div>
        )}
      </SwissSection>
    )
  }

  return (
    <>
      <SwissSection kicker="OLTP" title="业务库建模（第三范式）">
        {!oltp ? (
          <div className="system-state">后端没有返回 OLTP 建模说明。</div>
        ) : (
          <>
            <div className="system-schema-stats">
              <SwissStat label="业务表数" value={asNumber(oltp['表数']) ?? '—'} unit="张" />
            </div>
            {asString(oltp['范式']) ? (
              <p className="system-schema-note">{asString(oltp['范式'])}</p>
            ) : null}
            <TableList title="业务表" tables={asStringArray(oltp['表'])} />
          </>
        )}
      </SwissSection>

      <SwissSection kicker="OLAP" title="分析库建模（星型）">
        {!olap ? (
          <div className="system-state">后端没有返回 OLAP 建模说明。</div>
        ) : (
          <>
            <div className="system-schema-stats">
              <SwissStat
                label="维度表"
                value={asStringArray(olap['维度表']).length}
                unit="张"
              />
              <SwissStat
                label="事实表"
                value={asStringArray(olap['事实表']).length}
                unit="张"
              />
            </div>
            {asString(olap['建模']) ? (
              <p className="system-schema-note">{asString(olap['建模'])}</p>
            ) : null}
            <div className="system-schema-columns">
              <TableList title="维度表" tables={asStringArray(olap['维度表'])} />
              <TableList title="事实表" tables={asStringArray(olap['事实表'])} />
            </div>
            {asString(olap['ETL']) ? (
              <dl className="system-kv system-schema-etl">
                <div className="system-kv__row">
                  <dt>ETL</dt>
                  <dd>{asString(olap['ETL'])}</dd>
                </div>
              </dl>
            ) : null}
          </>
        )}
      </SwissSection>
    </>
  )
}
