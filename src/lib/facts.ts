import type { ParsedTable } from './csv'
import type { ChartSpec, ChartType } from './schema'

export type SeriesFacts = {
  name: string
  first: number
  firstLabel: string
  last: number
  lastLabel: string
  min: number
  minLabel: string
  max: number
  maxLabel: string
  change: number
  pctChange: number | null
}

export type TableFacts = {
  x: string
  xKind: string
  series: SeriesFacts[]
  /** Series with the largest growth (% change, or absolute change when a start is 0). */
  fastestGrowth: string | null
  /** Period with the highest / lowest value (sum across series when there are several). */
  bestPeriod: { label: string; value: number } | null
  worstPeriod: { label: string; value: number } | null
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return null
}

export function round(value: number, digits = 1): number {
  const f = 10 ** digits
  return Math.round(value * f) / f
}

export function computeFacts(table: ParsedTable): TableFacts | null {
  const numeric = table.columns.filter((c) => c.kind === 'number')
  const xCol = table.columns.find((c) => c.kind !== 'number') ?? table.columns[0]
  if (!xCol || table.rows.length === 0) return null
  const ys = numeric.filter((c) => c.name !== xCol.name)
  if (ys.length === 0) return null
  const labelOf = (i: number) => String(table.rows[i]?.[xCol.name] ?? i + 1)

  const series: SeriesFacts[] = []
  for (const col of ys) {
    const points = table.rows
      .map((row, i) => ({ v: num(row[col.name]), label: labelOf(i) }))
      .filter((p): p is { v: number; label: string } => p.v !== null)
    if (points.length === 0) continue
    const first = points[0]!
    const last = points[points.length - 1]!
    let min = first
    let max = first
    for (const p of points) {
      if (p.v < min.v) min = p
      if (p.v > max.v) max = p
    }
    const change = last.v - first.v
    series.push({
      name: col.name,
      first: first.v,
      firstLabel: first.label,
      last: last.v,
      lastLabel: last.label,
      min: min.v,
      minLabel: min.label,
      max: max.v,
      maxLabel: max.label,
      change,
      pctChange: first.v !== 0 ? (change / Math.abs(first.v)) * 100 : null,
    })
  }
  if (series.length === 0) return null

  let fastestGrowth: string | null = null
  if (series.length > 1) {
    const usePct = series.every((s) => s.pctChange !== null)
    const score = (s: SeriesFacts) => (usePct ? (s.pctChange as number) : s.change)
    const best = series.reduce((a, b) => (score(b) > score(a) ? b : a))
    fastestGrowth = score(best) > 0 ? best.name : null
  }

  const totals = table.rows.map((row, i) => ({
    label: labelOf(i),
    value: series.reduce((sum, s) => sum + (num(row[s.name]) ?? 0), 0),
  }))
  const bestPeriod = totals.reduce((a, b) => (b.value > a.value ? b : a))
  const worstPeriod = totals.reduce((a, b) => (b.value < a.value ? b : a))

  return { x: xCol.name, xKind: xCol.kind, series, fastestGrowth, bestPeriod, worstPeriod }
}

function fmt(value: number): string {
  return Number.isInteger(value) ? String(value) : String(round(value, 2))
}

export function factsBlock(facts: TableFacts): string {
  const lines = facts.series.map(
    (s) =>
      `- ${s.name}: ${s.firstLabel}=${fmt(s.first)} -> ${s.lastLabel}=${fmt(s.last)}, change ${s.change >= 0 ? '+' : ''}${fmt(s.change)}${
        s.pctChange === null ? '' : ` (${s.pctChange >= 0 ? '+' : ''}${round(s.pctChange)}%)`
      }, max ${fmt(s.max)} at ${s.maxLabel}, min ${fmt(s.min)} at ${s.minLabel}`,
  )
  if (facts.fastestGrowth) lines.push(`- Fastest growth: ${facts.fastestGrowth}`)
  if (facts.bestPeriod) {
    const what = facts.series.length > 1 ? 'total' : facts.series[0]!.name
    lines.push(`- Best ${facts.x}: ${facts.bestPeriod.label} (${what} ${fmt(facts.bestPeriod.value)})`)
    lines.push(`- Worst ${facts.x}: ${facts.worstPeriod!.label} (${what} ${fmt(facts.worstPeriod!.value)})`)
  }
  return lines.join('\n')
}

export function templatedInsight(facts: TableFacts): string {
  if (facts.series.length > 1 && facts.fastestGrowth) {
    const s = facts.series.find((item) => item.name === facts.fastestGrowth)!
    const pct = s.pctChange === null ? '' : ` (${s.pctChange >= 0 ? '+' : ''}${round(s.pctChange)}%)`
    return `${s.name} grew fastest, from ${fmt(s.first)} in ${s.firstLabel} to ${fmt(s.last)} in ${s.lastLabel}${pct}. Best ${facts.x} overall: ${facts.bestPeriod!.label}.`
  }
  const s = facts.series[0]!
  return `${s.maxLabel} is the peak at ${fmt(s.max)}; ${s.minLabel} is the low at ${fmt(s.min)}.`
}

const GROWTH_WORDS = /\b(grew|grow|growth|growing|fastest|increas\w*|rose|rising|climb\w*|gain\w*|most)\b/i
const COMPARATIVE = /\b(fastest|most|biggest|largest|strongest|top|leads?|leader|best)\b/i
const PEAK_WORDS = /\b(best|peak|highest|top|strongest|max\w*)\b/i

function variants(name: string): string[] {
  const lower = name.toLowerCase()
  return [...new Set([lower, lower.replace(/[_-]+/g, ' '), lower.replace(/[_\s-]+/g, '')])]
}

function mentions(text: string, name: string): boolean {
  const t = text.toLowerCase()
  return variants(name).some((v) => {
    const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(t)
  })
}

function numbersIn(text: string, labels: string[]): number[] {
  let t = text
  for (const label of [...labels].sort((a, b) => b.length - a.length)) {
    if (label) t = t.split(label).join(' ')
  }
  const out: number[] = []
  const re = /(-?\d[\d,]*(?:\.\d+)?)\s*(k|m)?\b/gi
  for (const match of t.matchAll(re)) {
    let value = Number(match[1]!.replace(/,/g, ''))
    if (!Number.isFinite(value)) continue
    const unit = match[2]?.toLowerCase()
    if (unit === 'k') value *= 1_000
    if (unit === 'm') value *= 1_000_000
    out.push(value)
  }
  return out
}

/** Returns a reason string when the insight contradicts the computed facts, else null. */
export function findContradiction(insight: string, facts: TableFacts, table: ParsedTable): string | null {
  const named = facts.series.filter((s) => mentions(insight, s.name))
  if (facts.fastestGrowth && GROWTH_WORDS.test(insight) && COMPARATIVE.test(insight) && named.length > 0) {
    if (!named.some((s) => s.name === facts.fastestGrowth)) {
      return `insight credits ${named.map((s) => s.name).join(', ')} with growth; ${facts.fastestGrowth} grew fastest`
    }
  }
  if (facts.bestPeriod && PEAK_WORDS.test(insight) && !GROWTH_WORDS.test(insight)) {
    const labels = [...new Set(table.rows.map((row) => String(row[facts.x] ?? '')))]
    const peaks = new Set([facts.bestPeriod.label, ...facts.series.map((s) => s.maxLabel)])
    const namedLabels = labels.filter((l) => l && insight.toLowerCase().includes(l.toLowerCase()))
    if (namedLabels.length > 0 && !namedLabels.some((l) => peaks.has(l))) {
      return `insight names ${namedLabels.join(', ')} as the peak; facts say ${facts.bestPeriod.label}`
    }
  }
  const allowed: number[] = []
  for (const row of table.rows) for (const v of Object.values(row)) if (typeof v === 'number') allowed.push(v)
  for (const s of facts.series) {
    allowed.push(s.change, Math.abs(s.change))
    if (s.pctChange !== null) allowed.push(s.pctChange, Math.abs(s.pctChange))
  }
  if (facts.bestPeriod) allowed.push(facts.bestPeriod.value, facts.worstPeriod!.value)
  allowed.push(table.rows.length, facts.series.length)
  const labels = table.rows.map((row) => String(row[facts.x] ?? ''))
  for (const n of numbersIn(insight, labels)) {
    const ok = allowed.some((a) => {
      const tol = Math.max(Math.abs(a) * 0.02, 0.6)
      return Math.abs(a - n) <= tol || Math.abs(a * 1000 - n) <= tol * 1000 || Math.abs(a / 1000 - n) <= 0.06
    })
    if (!ok) return `insight cites ${n}, which is not in the table or computed stats`
  }
  return null
}

const MULTI_OK: ChartType[] = ['grouped-bar', 'stacked-bar', 'line', 'area', 'horizontal-bar']

/** Include every numeric series unless the request names specific ones. */
export function includeAllSeries(spec: ChartSpec, facts: TableFacts, request: string): ChartSpec {
  const all = facts.series.map((s) => s.name)
  if (all.length < 2 || spec.y.length === all.length) return spec
  if (spec.series) return spec
  const requested = all.filter((name) => mentions(request, name))
  if (requested.length > 0) return spec
  if (spec.x !== facts.x) return spec
  let type: ChartType = spec.type
  if (type === 'bar') type = 'grouped-bar'
  else if (!MULTI_OK.includes(type)) type = facts.xKind === 'date' ? 'line' : 'grouped-bar'
  return { ...spec, type, y: all, yLabel: spec.y.length === 1 && spec.yLabel === spec.y[0] ? all.join(', ') : spec.yLabel }
}

export type GroundResult = { spec: ChartSpec; overridden: string | null }

export function groundSpec(
  table: ParsedTable,
  spec: ChartSpec,
  request: string,
  options: { expandSeries?: boolean } = {},
): GroundResult {
  const facts = computeFacts(table)
  if (!facts) return { spec, overridden: null }
  const next = options.expandSeries === false ? spec : includeAllSeries(spec, facts, request)
  const reason = findContradiction(next.insight, facts, table)
  if (reason) return { spec: { ...next, insight: templatedInsight(facts) }, overridden: reason }
  return { spec: next, overridden: null }
}
