import { init, type ECharts, type EChartsOption } from 'echarts'
import { useLayoutEffect, useRef } from 'react'
import './BaseChart.css'

type BaseChartProps = {
  option: EChartsOption
  /** 图表用途，读屏时使用 */
  ariaLabel: string
  height?: number
  /** 没有数据时显示占位，不画空坐标轴 */
  isEmpty?: boolean
  emptyText?: string
  onItemClick?: (data: unknown, dataType?: string) => void
}

/**
 * ECharts 容器：负责实例生命周期、resize、卸载清理。
 * 具体图表只传 option，不在这里写业务。
 */
export default function BaseChart({
  option,
  ariaLabel,
  height = 320,
  isEmpty = false,
  emptyText = '暂无数据',
  onItemClick,
}: BaseChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const latest = useRef({ option, onItemClick })
  const refresh = useRef<(() => void) | null>(null)

  useLayoutEffect(() => {
    latest.current = { option, onItemClick }
    refresh.current?.()
  }, [option, onItemClick])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container || isEmpty) return
    let chart: ECharts | undefined
    let applied: EChartsOption | undefined

    const render = () => {
      const width = container.clientWidth
      const height = container.clientHeight
      // A tab or route can disappear before ResizeObserver delivers its last event.
      // A zero-sized Sankey has no invertible view transform.
      if (!container.isConnected || width < 2 || height < 2) return
      if (!chart) {
        chart = init(container, undefined, { width, height })
        chart.on('click', (event: { data: unknown; dataType?: string }) =>
          latest.current.onItemClick?.(event.data, event.dataType))
      } else if (chart.getWidth() !== width || chart.getHeight() !== height) {
        chart.resize({ width, height })
      }
      const next = latest.current.option
      if (next === applied) return
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      chart.setOption({
        animationDuration: 240, animationDurationUpdate: 170, ...next,
        ...(reduceMotion ? { animation: false } : {}),
      }, { notMerge: true })
      applied = next
    }

    refresh.current = render
    render()
    const observer = new ResizeObserver(render)
    observer.observe(container)
    return () => {
      refresh.current = null
      observer.disconnect()
      chart?.dispose()
    }
  }, [isEmpty])

  return (
    <figure className="base-chart">
      {isEmpty ? (
        <div className="base-chart__empty" style={{ height }} role="img" aria-label={`${ariaLabel}：${emptyText}`}>
          {emptyText}
        </div>
      ) : (
        <div
          ref={containerRef}
          className="base-chart__canvas"
          style={{ height }}
          role="img"
          aria-label={ariaLabel}
        />
      )}
    </figure>
  )
}
