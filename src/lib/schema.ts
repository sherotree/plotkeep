import { z } from 'zod'

export const CHART_TYPES = [
  'bar',
  'grouped-bar',
  'stacked-bar',
  'horizontal-bar',
  'line',
  'area',
  'pie',
  'donut',
  'scatter',
] as const

export type ChartType = (typeof CHART_TYPES)[number]

export const ChartSpecSchema = z.object({
  type: z.enum(CHART_TYPES),
  title: z.string().trim().min(1).max(160),
  insight: z.string().trim().min(1).max(600),
  x: z.string().trim().min(1),
  y: z.union([z.string().trim().min(1), z.array(z.string().trim().min(1)).min(1)]),
  series: z.string().trim().min(1).nullable().optional(),
  xLabel: z.string().trim().max(80).optional(),
  yLabel: z.string().trim().max(80).optional(),
})

export type ChartSpecInput = z.infer<typeof ChartSpecSchema>

export type ChartSpec = {
  type: ChartType
  title: string
  insight: string
  x: string
  y: string[]
  series?: string
  xLabel: string
  yLabel: string
}

export const GeneratedBundleSchema = z.object({
  table: z.object({
    columns: z.array(z.string().trim().min(1)).min(2),
    rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))).min(2).max(40),
  }),
  spec: ChartSpecSchema,
})

export function normalizeSpec(input: ChartSpecInput): ChartSpec {
  const y = Array.isArray(input.y) ? input.y : [input.y]
  return {
    type: input.type,
    title: input.title.trim(),
    insight: input.insight.trim(),
    x: input.x.trim(),
    y: y.map((name) => name.trim()),
    series: input.series?.trim() || undefined,
    xLabel: input.xLabel?.trim() || input.x.trim(),
    yLabel: input.yLabel?.trim() || y.join(', '),
  }
}

export const SPEC_JSON_SHAPE = `{
  "type": "bar|grouped-bar|stacked-bar|horizontal-bar|line|area|pie|donut|scatter",
  "title": "short title",
  "insight": "one or two sentences grounded in the numbers",
  "x": "existing column name",
  "y": "existing numeric column, or array of them",
  "series": "optional grouping column or omit",
  "xLabel": "axis label",
  "yLabel": "axis label"
}`
