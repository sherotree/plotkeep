import type { EChartsOption, SeriesOption } from 'echarts'
import { uniqueValues, type ParsedTable } from './csv'
import { CHART_COLORS, INK } from './palette'
import type { ChartSpec } from './schema'

function numberAt(table: ParsedTable, rowIndex: number, field: string): number {
  const value = table.rows[rowIndex]?.[field]
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function axisText(color: string) {
  return {
    color,
    fontFamily: 'Libre Franklin, sans-serif',
    fontSize: 11,
  }
}

function groupedFromSeries(table: ParsedTable, spec: ChartSpec): { categories: string[]; series: SeriesOption[] } {
  const seriesNames = uniqueValues(table, spec.series!)
  const categories = uniqueValues(table, spec.x)
  const yField = spec.y[0]!
  const lookup = new Map<string, number>()
  for (const row of table.rows) {
    const key = `${String(row[spec.x] ?? '')}::${String(row[spec.series!] ?? '')}`
    const value = row[yField]
    lookup.set(key, typeof value === 'number' ? value : 0)
  }
  const chartType = spec.type === 'line' || spec.type === 'area' ? 'line' : 'bar'
  const series: SeriesOption[] = seriesNames.map((name, index) => ({
    name,
    type: chartType,
    stack: spec.type === 'stacked-bar' ? 'total' : undefined,
    areaStyle: spec.type === 'area' ? { opacity: 0.18 } : undefined,
    data: categories.map((category) => lookup.get(`${category}::${name}`) ?? 0),
    itemStyle: { color: CHART_COLORS[index % CHART_COLORS.length] },
    emphasis: { focus: 'series' },
  }))
  return { categories, series }
}

function cartesianSeries(table: ParsedTable, spec: ChartSpec): SeriesOption[] {
  const isLine = spec.type === 'line' || spec.type === 'area'
  return spec.y.map((field, index) => ({
    name: field,
    type: isLine ? 'line' : spec.type === 'scatter' ? 'scatter' : 'bar',
    stack: spec.type === 'stacked-bar' ? 'total' : undefined,
    areaStyle: spec.type === 'area' ? { opacity: 0.18 } : undefined,
    smooth: isLine,
    symbolSize: spec.type === 'scatter' ? 11 : 6,
    data: table.rows.map((_, rowIndex) => numberAt(table, rowIndex, field)),
    itemStyle: { color: CHART_COLORS[index % CHART_COLORS.length] },
    emphasis: { focus: 'series' },
  }))
}

export function toEchartsOption(table: ParsedTable, spec: ChartSpec): EChartsOption {
  const text = '#efe6d3'
  const muted = '#cbbfa6'
  const split = 'rgba(201,185,154,0.18)'
  const textStyle = axisText(muted)

  if (spec.type === 'pie' || spec.type === 'donut') {
    const yField = spec.y[0]!
    return {
      backgroundColor: INK.plate,
      color: CHART_COLORS,
      tooltip: { trigger: 'item' },
      legend: {
        bottom: 8,
        textStyle,
        icon: 'circle',
      },
      series: [
        {
          type: 'pie',
          radius: spec.type === 'donut' ? ['42%', '68%'] : '68%',
          center: ['50%', '46%'],
          data: table.rows.map((row, index) => ({
            name: String(row[spec.x] ?? ''),
            value: numberAt(table, index, yField),
          })),
          label: {
            color: text,
            fontFamily: 'Libre Franklin, sans-serif',
            formatter: '{b}\n{d}%',
          },
          itemStyle: {
            borderColor: INK.plate,
            borderWidth: 2,
          },
        },
      ],
    }
  }

  if (spec.type === 'scatter') {
    const yField = spec.y[0]!
    return {
      backgroundColor: INK.plate,
      color: CHART_COLORS,
      tooltip: { trigger: 'item' },
      grid: { left: 56, right: 24, top: 28, bottom: 48 },
      xAxis: {
        type: 'value',
        name: spec.xLabel,
        nameLocation: 'middle',
        nameGap: 32,
        nameTextStyle: textStyle,
        splitLine: { lineStyle: { color: split, type: 'dashed' } },
        axisLabel: textStyle,
      },
      yAxis: {
        type: 'value',
        name: spec.yLabel,
        nameTextStyle: textStyle,
        splitLine: { lineStyle: { color: split, type: 'dashed' } },
        axisLabel: textStyle,
      },
      series: [
        {
          type: 'scatter',
          symbolSize: 11,
          data: table.rows.map((row, index) => [
            typeof row[spec.x] === 'number' ? row[spec.x] : numberAt(table, index, spec.x),
            numberAt(table, index, yField),
          ]),
          itemStyle: { color: CHART_COLORS[0] },
        },
      ],
    }
  }

  const grouped = spec.series ? groupedFromSeries(table, spec) : null
  const categories = grouped ? grouped.categories : table.rows.map((row) => String(row[spec.x] ?? ''))
  const series = grouped ? grouped.series : cartesianSeries(table, spec)
  const horizontal = spec.type === 'horizontal-bar'
  const categoryAxis = {
    type: 'category' as const,
    data: categories,
    name: spec.xLabel,
    nameLocation: 'middle' as const,
    nameGap: 32,
    nameTextStyle: textStyle,
    axisLabel: { ...textStyle, hideOverlap: true },
    axisLine: { lineStyle: { color: 'rgba(201,185,154,0.4)' } },
    axisTick: { show: false },
  }
  const valueAxis = {
    type: 'value' as const,
    name: spec.yLabel,
    nameTextStyle: textStyle,
    splitLine: { lineStyle: { color: split, type: 'dashed' as const } },
    axisLabel: textStyle,
    axisLine: { show: false },
  }

  return {
    backgroundColor: INK.plate,
    color: CHART_COLORS,
    tooltip: { trigger: 'axis' },
    legend: {
      top: 8,
      textStyle,
      icon: 'circle',
      show: spec.y.length > 1 || Boolean(spec.series),
    },
    grid: {
      left: horizontal ? 88 : 52,
      right: 24,
      top: spec.y.length > 1 || spec.series ? 42 : 28,
      bottom: 48,
    },
    xAxis: horizontal ? valueAxis : categoryAxis,
    yAxis: horizontal ? categoryAxis : valueAxis,
    series,
  }
}

export function slugTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
  return slug || 'plotkeep-chart'
}
