import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { documentsApi } from '../../api'
import { ApiRequestError } from '../../api/client'
import type { SourceDocument } from '../../api/types'
import { SwissError } from '../../components/swiss'
import ReviewWorkspace from './swiss/ReviewWorkspace'
import './ReviewPage.css'

/** 数据核对采用方案 3 · 校对工作台，数据来自 /api/v1/documents/{id} */
export default function ReviewPage() {
  const { id } = useParams<{ id: string }>()
  const docId = id ? Number(id) : Number.NaN

  const [document, setDocument] = useState<SourceDocument | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)

  const load = useCallback(async () => {
    if (!Number.isFinite(docId)) {
      setMissing(true)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    setMissing(false)
    try {
      setDocument(await documentsApi.getDocument(docId))
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 404) {
        setMissing(true)
      } else {
        setError(err instanceof ApiRequestError ? err.message : '单据加载失败')
      }
    } finally {
      setLoading(false)
    }
  }, [docId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="review-swiss">
      <div className="review-wrap">
        {loading ? (
          <main className="review-missing">
            <div className="review-missing-kicker">Review / loading</div>
            <h1>正在加载单据</h1>
            <p>读取识别结果与校对状态…</p>
          </main>
        ) : error ? (
          <main className="review-missing">
            <SwissError
              message={error}
              onRetry={load}
              backTo={{ to: '/documents', label: '返回单据列表' }}
            />
          </main>
        ) : !document || missing ? (
          <main className="review-missing">
            <div className="review-missing-kicker">Review / missing</div>
            <h1>找不到这张单据</h1>
            <p>该单据不存在，或当前账号没有访问权限。</p>
            <Link className="review-missing-link" to="/documents">返回单据列表 →</Link>
          </main>
        ) : (
          <ReviewWorkspace key={document.id} document={document} />
        )}
      </div>
    </div>
  )
}
