import type { ChartSpec, ChartType } from './schema'
import { CHART_TYPES } from './schema'
import { insightFor } from './heuristic'
import type { ParsedTable } from './csv'

const TYPE_PATTERNS: { test: RegExp; type: ChartType }[] = [
  { test: /\bdonut\b/, type: 'donut' },
  { test: /\bpie\b/, type: 'pie' },
  { test: /\bscatter\b/, type: 'scatter' },
  { test: /\barea\b/, type: 'area' },
  { test: /\bline\b/, type: 'line' },
  { test: /\bstack/, type: 'stacked-bar' },
  { test: /\bhorizontal\b|\bsideways\b/, type: 'horizontal-bar' },
  { test: /\bgroup/, type: 'grouped-bar' },
  { test: /\bbar\b/, type: 'bar' },
]

function quotedTitle(prompt: string): string | null {
  const named = prompt.match(/title\s+(?:to|as)\s+["“']([^"”']+)["”']/i)
  if (named?.[1]) return named[1].trim()
  const quoted = prompt.match(/["“]([^"”]+)["”]/)
  if (quoted?.[1] && /title/i.test(prompt)) return quoted[1].trim()
  return null
}

function requestedColumns(prompt: string, columns: string[]): string[] {
  const lower = prompt.toLowerCase()
  return columns.filter((column) => lower.includes(column.toLowerCase()))
}

export function applyFollowup(
  table: ParsedTable,
  spec: ChartSpec,
  prompt: string,
): { spec: ChartSpec; applied: string[]; unmatched: boolean } {
  const applied: string[] = []
  const next: ChartSpec = { ...spec, y: [...spec.y] }
  const text = prompt.trim()
  const lower = text.toLowerCase()

  for (const pattern of TYPE_PATTERNS) {
    if (pattern.test.test(lower) && next.type !== pattern.type) {
      next.type = pattern.type
      applied.push(`chart type → ${pattern.type}`)
      break
    }
  }

  const title = quotedTitle(text)
  if (title) {
    next.title = title
    applied.push(`title → ${title}`)
  }

  const columns = table.columns.map((column) => column.name)
  const mentioned = requestedColumns(text, columns)
  const numeric = table.columns.filter((column) => column.kind === 'number').map((column) => column.name)
  const labels = table.columns.filter((column) => column.kind !== 'number').map((column) => column.name)

  if (/\bonly\b|\bjust\b|\bdrop\b|\bhide\b|\bremove\b/.test(lower) && mentioned.length) {
    const keep = mentioned.filter((name) => numeric.includes(name))
    if (keep.length) {
      next.y = keep
      applied.push(`series → ${keep.join(', ')}`)
    }
  } else if (mentioned.length) {
    const yHits = mentioned.filter((name) => numeric.includes(name))
    const xHits = mentioned.filter((name) => labels.includes(name))
    if (xHits[0] && /\bx\b|\blabel|\bcategor|\bby\b/.test(lower)) {
      next.x = xHits[0]
      next.xLabel = xHits[0]
      applied.push(`x → ${xHits[0]}`)
    }
    if (yHits.length && /\by\b|\bvalue|\bmetric|\buse\b/.test(lower)) {
      next.y = yHits
      next.yLabel = yHits.join(', ')
      applied.push(`y → ${yHits.join(', ')}`)
    }
  }

  if (applied.length) {
    next.insight = insightFor(table, next)
    return { spec: next, applied, unmatched: false }
  }

  if (CHART_TYPES.some((type) => lower.includes(type))) {
    return { spec: next, applied, unmatched: false }
  }

  return { spec, applied, unmatched: true }
}
