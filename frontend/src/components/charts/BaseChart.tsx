import { init, type ECharts, type EChartsOption } from 'echarts'
import { useEffect, useRef } from 'react'
import './BaseChart.css'

type BaseChartProps = {
  option: EChartsOption
  /** 图表用途，读屏时使用 */
  ariaLabel: string
  height?: number
  /** 没有数据时显示占位，不画空坐标轴 */
  isEmpty?: boolean
  emptyText?: string
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
}: BaseChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ECharts | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || isEmpty) return

    const chart = init(container)
    chartRef.current = chart

    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)

    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(container)

    return () => {
      window.removeEventListener('resize', handleResize)
      observer.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [isEmpty])

  useEffect(() => {
    if (isEmpty) return
    chartRef.current?.setOption(option, { notMerge: true })
  }, [option, isEmpty])

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
