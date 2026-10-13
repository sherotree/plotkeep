import { uniqueValues, type Column, type ParsedTable } from './csv'
import type { ChartSpec, ChartType } from './schema'
import { loadSample } from './samples'

export type Suggestion = {
  spec: ChartSpec
  reason: string
  source: 'heuristic'
}

function numericColumns(table: ParsedTable): Column[] {
  return table.columns.filter((column) => column.kind === 'number')
}

function looksTemporalName(name: string): boolean {
  return /^(week|month|day|date|year|quarter|period|time)\b/i.test(name)
}

function temporalColumns(table: ParsedTable): Column[] {
  return table.columns.filter(
    (column) => column.kind === 'date' || looksTemporalName(column.name),
  )
}

function categoricalColumns(table: ParsedTable): Column[] {
  const temporal = new Set(temporalColumns(table).map((column) => column.name))
  return table.columns.filter((column) => column.kind === 'string' && !temporal.has(column.name))
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  if (abs >= 1000) return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)
  if (Number.isInteger(value)) return String(value)
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)
}

function hintType(prompt: string): ChartType | null {
  const t = prompt.toLowerCase()
  if (/\bdonut\b/.test(t)) return 'donut'
  if (/\bpie\b|\bbreakdown\b|\bmix\b|\bshare\b|\bpercent/.test(t)) return 'pie'
  if (/\bscatter\b|\bcorrelation\b|\bvs\.?\b/.test(t)) return 'scatter'
  if (/\barea\b/.test(t)) return 'area'
  if (/\bline\b|\btrend\b|\bover time\b/.test(t)) return 'line'
  if (/\bstack/.test(t)) return 'stacked-bar'
  if (/\bhorizontal\b|\branked\b/.test(t)) return 'horizontal-bar'
  if (/\bgroup|\bcompare|\bside by side/.test(t)) return 'grouped-bar'
  if (/\bbar\b/.test(t)) return 'bar'
  return null
}

export function insightFor(table: ParsedTable, spec: ChartSpec): string {
  const y = spec.y[0]
  if (!y) return 'No numeric column to summarize.'
  const labeled = table.rows.map((row) => ({
    name: String(row[spec.x] ?? ''),
    values: spec.y.map((field) => {
      const value = row[field]
      return typeof value === 'number' ? value : Number.NaN
    }),
  }))
  const primary = labeled
    .map((row) => ({ name: row.name, value: row.values[0] ?? Number.NaN }))
    .filter((row) => Number.isFinite(row.value))
  if (primary.length === 0) return 'The selected numeric column has no usable numbers.'

  if (spec.type === 'pie' || spec.type === 'donut') {
    const total = primary.reduce((sum, row) => sum + row.value, 0)
    const ranked = [...primary].sort((a, b) => b.value - a.value)
    const top = ranked[0]
    if (!top || total === 0) return `${y} has no positive totals to split.`
    const pct = Math.round((top.value / total) * 100)
    return `${top.name} is ${pct}% of ${spec.yLabel || y} (${formatNumber(top.value)} of ${formatNumber(total)}).`
  }

  if (spec.type === 'scatter') {
    return `${spec.xLabel} against ${spec.yLabel}. ${primary.length} points from the pasted table — no extra points invented.`
  }

  const peak = [...primary].sort((a, b) => b.value - a.value)[0]
  const trough = [...primary].sort((a, b) => a.value - b.value)[0]
  if (!peak || !trough) return `${y} plotted across ${primary.length} rows.`
  if (peak.name === trough.name) {
    return `${peak.name} sits at ${formatNumber(peak.value)}.`
  }
  if (spec.y.length > 1) {
    return `${peak.name} leads ${y} at ${formatNumber(peak.value)}; ${trough.name} is the low at ${formatNumber(trough.value)}. ${spec.y.length} series from the sheet.`
  }
  return `${peak.name} is the peak at ${formatNumber(peak.value)}; ${trough.name} is the low at ${formatNumber(trough.value)}.`
}

function defaultTitle(spec: Omit<ChartSpec, 'title' | 'insight'>): string {
  if (spec.y.length === 1) return `${spec.y[0]} by ${spec.x}`
  return `${spec.y.join(' / ')} by ${spec.x}`
}

export function suggestChart(table: ParsedTable, prompt = ''): Suggestion {
  const hinted = hintType(prompt)
  const nums = numericColumns(table)
  const dates = temporalColumns(table)
  const cats = categoricalColumns(table)
  const names = table.columns.map((column) => column.name)

  if (nums.length === 0) {
    throw new Error(`No numeric column found. Columns: ${names.join(', ') || '(none)'}.`)
  }

  let type: ChartType = hinted ?? 'bar'
  let x = (dates[0] ?? cats[0] ?? table.columns.find((column) => column.kind !== 'number') ?? table.columns[0])
    ?.name
  let y = [nums[0]?.name]
  let series: string | undefined
  let reason = 'Defaulted to a bar chart from the first category and first number.'

  if (!x || !y[0]) {
    throw new Error('Need at least one label column and one numeric column.')
  }

  const extraNums = nums.slice(1).map((column) => column.name)
  const xUniques = uniqueValues(table, x).length

  if (!hinted && dates.length && nums.length) {
    type = nums.length > 1 ? 'line' : 'line'
    x = dates[0]!.name
    y = nums.length > 1 ? nums.map((column) => column.name) : [nums[0]!.name]
    reason = 'A date-like column plus numbers usually wants a line, not a pie.'
  } else if (!hinted && cats.length >= 2 && nums.length >= 1) {
    const rankedCats = [...cats].sort(
      (a, b) => uniqueValues(table, b.name).length - uniqueValues(table, a.name).length,
    )
    const high = rankedCats[0]!
    const low = rankedCats[1]!
    const lowCard = uniqueValues(table, low.name).length
    if (lowCard >= 2 && lowCard <= 8 && uniqueValues(table, high.name).length >= 3) {
      type = 'grouped-bar'
      x = high.name
      y = [nums[0]!.name]
      series = low.name
      reason = `Treated ${low.name} as a grouping (${lowCard} values) across ${high.name}.`
    }
  } else if (!hinted && cats.length && nums.length >= 1 && extraNums.length && dates.length === 0) {
    // Don't plot hours against rate (or tickets against revenue) on one axis
    // unless the user asked for a comparison.
    type = xUniques <= 8 && table.rows.length <= 10 ? 'pie' : 'bar'
    y = [nums[0]!.name]
    reason = `Used ${y[0]} only. Other numbers (${extraNums.join(', ')}) stay off the plate until you ask — mixed units wreck a shared axis.`
  } else if (!hinted && cats.length && nums.length === 1 && xUniques <= 8 && table.rows.length <= 10) {
    type = 'pie'
    reason = 'Few categories and one number — a mix chart reads faster than a bar.'
  } else if (!hinted && cats.length && extraNums.length) {
    type = 'grouped-bar'
    y = nums.map((column) => column.name)
    reason = `Multiple numeric columns (${y.join(', ')}) as grouped bars.`
  } else if (!hinted && nums.length >= 2 && cats.length === 0 && dates.length === 0) {
    type = 'scatter'
    x = nums[0]!.name
    y = [nums[1]!.name]
    reason = 'Two numeric columns and no labels — scatter.'
  }

  if (hinted === 'scatter' && nums.length >= 2) {
    x = nums[0]!.name
    y = [nums[1]!.name]
    series = undefined
    reason = 'Scatter from the first two numeric columns, as requested.'
  }
  if (hinted === 'pie' || hinted === 'donut') {
    y = [nums[0]!.name]
    series = undefined
    if (dates[0] && !cats.length) x = dates[0].name
    reason = `Forced ${hinted} from the prompt.`
  }
  if (hinted === 'grouped-bar' && extraNums.length) {
    y = nums.map((column) => column.name)
    reason = 'Grouped bars from every numeric column.'
  }
  if (hinted === 'stacked-bar' && extraNums.length) {
    y = nums.map((column) => column.name)
    reason = 'Stacked bars from every numeric column.'
  }
  if ((hinted === 'line' || hinted === 'area') && extraNums.length) {
    y = nums.map((column) => column.name)
  }
  if (hinted === 'horizontal-bar') {
    reason = 'Horizontal bars, as requested — useful when labels are long.'
  }

  const draft: Omit<ChartSpec, 'title' | 'insight'> = {
    type,
    x,
    y: y.filter((name): name is string => Boolean(name)),
    series,
    xLabel: x,
    yLabel: y.filter(Boolean).join(', '),
  }
  const spec: ChartSpec = {
    ...draft,
    title: defaultTitle(draft),
    insight: '',
  }
  spec.insight = insightFor(table, spec)
  return { spec, reason, source: 'heuristic' }
}

const PROSE_SAMPLES: { test: RegExp; id: 'invoices' | 'hours' | 'skus' | 'traffic'; note: string }[] = [
  { test: /hour|client|billable|freelance/i, id: 'hours', note: 'Matched hours/client language to the sample mix.' },
  { test: /sku|cafe|coffee|ticket|pastry|menu/i, id: 'skus', note: 'Matched a counter/SKU description.' },
  { test: /session|signup|traffic|visit|web/i, id: 'traffic', note: 'Matched traffic language to weekly sessions.' },
  { test: /invoice|revenue|sales|month|collected|overdue/i, id: 'invoices', note: 'Matched a monthly money series.' },
]

export function syntheticFromProse(prompt: string): { table: ParsedTable; spec: ChartSpec; reason: string } {
  const hit = PROSE_SAMPLES.find((entry) => entry.test.test(prompt)) ?? {
    id: 'invoices' as const,
    note: 'No table pasted and no strong keywords — used the invoice sample so the press still runs.',
  }
  const table = loadSample(hit.id)
  const suggestion = suggestChart(table, prompt)
  const titleFromPrompt = prompt.trim().replace(/\s+/g, ' ')
  if (titleFromPrompt.length > 8 && titleFromPrompt.length < 80 && !looksLikeDataDump(titleFromPrompt)) {
    suggestion.spec.title = titleFromPrompt.charAt(0).toUpperCase() + titleFromPrompt.slice(1)
  }
  suggestion.spec.insight = insightFor(table, suggestion.spec)
  return {
    table,
    spec: suggestion.spec,
    reason: `${hit.note} Numbers are a built-in sample, not a model guess.`,
  }
}

function looksLikeDataDump(text: string): boolean {
  return text.includes(',') || text.includes('\t') || /\d+\s+\d+/.test(text)
}

export function isWeakInsight(text: string): boolean {
  const t = text.trim()
  if (t.length < 24) return true
  return /this chart shows|the data (is|are) displayed|visuali[sz]e the|as you can see/i.test(t)
}

export function withGroundedInsight(table: ParsedTable, spec: ChartSpec): ChartSpec {
  if (isWeakInsight(spec.insight)) {
    return { ...spec, insight: insightFor(table, spec) }
  }
  return spec
}
