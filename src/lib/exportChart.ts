import type { EChartsOption } from 'echarts'
import { echarts } from './echartsRuntime'
import { INK } from './palette'
import { slugTitle } from './echartsOption'

function downloadDataUrl(dataUrl: string, filename: string) {
  const anchor = document.createElement('a')
  anchor.href = dataUrl
  anchor.download = filename
  anchor.click()
}

export function exportChart(
  option: EChartsOption,
  format: 'png' | 'svg',
  title: string,
  pixelRatio = 1,
) {
  const host = document.createElement('div')
  host.style.width = '960px'
  host.style.height = '540px'
  host.style.position = 'fixed'
  host.style.left = '-9999px'
  document.body.append(host)
  const chart = echarts.init(host, undefined, {
    renderer: format === 'svg' ? 'svg' : 'canvas',
    width: 960,
    height: 540,
  })
  chart.setOption(option)
  const dataUrl = chart.getDataURL({
    type: format,
    pixelRatio: format === 'png' ? pixelRatio : 1,
    backgroundColor: INK.plate,
  })
  chart.dispose()
  host.remove()
  downloadDataUrl(dataUrl, `${slugTitle(title)}.${format}`)
}
