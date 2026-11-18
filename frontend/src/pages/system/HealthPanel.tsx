import { API_BASE_URL } from '../../api'
import {
  SwissError,
  SwissSection,
} from '../../components/swiss'
import type { StatusTone } from './labels'
import { healthStatusLabel, healthStatusTone } from './labels'
import { useSystemStatus } from './useSystemStatus'

type EngineCard = {
  name: string
  model: string
  statusText: string
  tone: StatusTone
  details: Array<{ label: string; value: string }>
}

/** 运行状态页签：/healthz 状态与算法版本 + 五类 AI 引擎状态 */
export default function HealthPanel() {
  const {
    health,
    healthLoading,
    healthError,
    ai,
    aiLoading,
    aiError,
    reload,
  } = useSystemStatus()

  const engines: EngineCard[] = ai
    ? [
        {
          name: 'OCR',
          model: ai.ocr.model,
          statusText: ai.ocr.status === 'ready' ? '就绪' : ai.ocr.status,
          tone: ai.ocr.status === 'ready' ? 'accent' : 'warn',
          details: [],
        },
        {
          name: 'LayoutLMv3',
          model: ai.layoutlmv3.model,
          statusText: ai.layoutlmv3.loaded
            ? '已加载'
            : ai.layoutlmv3.provisioned
              ? '已部署，未加载'
              : '未部署',
          tone: ai.layoutlmv3.loaded ? 'accent' : ai.layoutlmv3.provisioned ? 'warn' : 'muted',
          details: [
            { label: '模型文件', value: ai.layoutlmv3.provisioned ? '已缓存' : '未缓存' },
          ],
        },
        {
          name: 'SER',
          model: ai.ser.model,
          statusText: ai.ser.enabled
            ? ai.ser.loaded
              ? '已加载'
              : '已启用，未加载'
            : '已关闭',
          tone: ai.ser.enabled ? (ai.ser.loaded ? 'accent' : 'warn') : 'muted',
          details: [{ label: '说明', value: ai.ser.note }],
        },
        {
          name: 'SBERT',
          model: ai.sbert.model,
          statusText: ai.sbert.loaded
            ? '已加载'
            : ai.sbert.provisioned
              ? '已部署，未加载'
              : '未部署',
          tone: ai.sbert.loaded ? 'accent' : ai.sbert.provisioned ? 'warn' : 'muted',
          details: [{ label: '模型文件', value: ai.sbert.provisioned ? '已缓存' : '未缓存' }],
        },
        {
          name: 'LLM',
          model: ai.llm.model,
          statusText: ai.llm.enabled ? '已启用' : '未启用',
          tone: ai.llm.enabled ? 'accent' : 'muted',
          details: [
            ...(typeof ai.llm.check.message === 'string'
              ? [{ label: '检查', value: ai.llm.check.message }]
              : []),
            { label: '说明', value: ai.llm.note },
          ],
        },
      ]
    : []

  return (
    <>
      <SwissSection
        kicker="Runtime"
        title="服务运行状态"
        extra={
          <a
            className="system-metrics-link"
            href={`${API_BASE_URL}/metrics`}
            target="_blank"
            rel="noreferrer"
          >
            打开 /metrics →
          </a>
        }
      >
        {healthError ? (
          <SwissError message={healthError} onRetry={reload} />
        ) : healthLoading ? (
          <div className="system-state" role="status">
            正在检查服务状态…
          </div>
        ) : health ? (
          <dl className="system-kv">
            <div className="system-kv__row">
              <dt>健康状态</dt>
              <dd>
                <span
                  className={`system-status system-status--${healthStatusTone(health.status)}`}
                >
                  {healthStatusLabel(health.status)}
                </span>
              </dd>
            </div>
            <div className="system-kv__row">
              <dt>算法版本</dt>
              <dd>{health.algorithm_version}</dd>
            </div>
            <div className="system-kv__row">
              <dt>API 地址</dt>
              <dd>{API_BASE_URL}</dd>
            </div>
          </dl>
        ) : null}
      </SwissSection>

      <SwissSection kicker="AI engines" title="AI 引擎状态">
        {aiError ? (
          <SwissError message={aiError} onRetry={reload} />
        ) : aiLoading ? (
          <div className="system-state" role="status">
            正在读取 AI 引擎状态…
          </div>
        ) : engines.length === 0 ? (
          <div className="system-state">后端没有返回 AI 引擎状态。</div>
        ) : (
          <div className="system-engine-grid">
            {engines.map((engine) => (
              <article key={engine.name} className="system-engine">
                <header className="system-engine__head">
                  <span className="system-engine__name">{engine.name}</span>
                  <span className={`system-status system-status--${engine.tone}`}>
                    {engine.statusText}
                  </span>
                </header>
                <div className="system-engine__model">{engine.model}</div>
                {engine.details.length > 0 ? (
                  <dl className="system-engine__details">
                    {engine.details.map((detail) => (
                      <div key={detail.label}>
                        <dt>{detail.label}</dt>
                        <dd>{detail.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </SwissSection>
    </>
  )
}
