import { useEffect, useRef } from 'react'
import type { EChartsOption } from 'echarts'
import { echarts } from '../lib/echartsRuntime'

type Props = {
  option: EChartsOption | null
  emptyHint: string
}

export function ChartCanvas({ option, emptyHint }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ReturnType<typeof echarts.init> | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const chart = echarts.init(host, undefined, { renderer: 'canvas' })
    chartRef.current = chart
    const resize = () => chart.resize()
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    window.addEventListener('resize', resize)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', resize)
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !option) return
    chart.setOption(option, { notMerge: true })
  }, [option])

  return (
    <div className="plate-canvas-wrap">
      <div ref={hostRef} className="plate-canvas" role="img" aria-label="Chart plate" />
      {!option ? <p className="plate-empty">{emptyHint}</p> : null}
    </div>
  )
}
