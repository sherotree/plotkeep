import type { ChartSpec, ChartSpecInput } from './schema'
import { ChartSpecSchema, normalizeSpec } from './schema'
import type { ParsedTable } from './csv'

export class SpecBindError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SpecBindError'
  }
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '')
}

export function resolveColumn(name: string, columns: string[]): string | null {
  if (columns.includes(name)) return name
  const lower = columns.find((column) => column.toLowerCase() === name.toLowerCase())
  if (lower) return lower
  const compact = normalizeName(name)
  const compactHit = columns.filter((column) => normalizeName(column) === compact)
  if (compactHit.length === 1) return compactHit[0] ?? null
  const includes = columns.filter((column) => {
    const c = column.toLowerCase()
    const n = name.toLowerCase()
    return c.includes(n) || n.includes(c)
  })
  if (includes.length === 1) return includes[0] ?? null
  return null
}

export function bindSpec(table: ParsedTable, input: ChartSpecInput): ChartSpec {
  const spec = normalizeSpec(input)
  const names = table.columns.map((column) => column.name)
  const x = resolveColumn(spec.x, names)
  if (!x) {
    throw new SpecBindError(`Column "${spec.x}" is not in the table (${names.join(', ')}).`)
  }
  const y = spec.y.map((field) => {
    const resolved = resolveColumn(field, names)
    if (!resolved) {
      throw new SpecBindError(`Column "${field}" is not in the table (${names.join(', ')}).`)
    }
    return resolved
  })
  const series = spec.series ? resolveColumn(spec.series, names) : undefined
  if (spec.series && !series) {
    throw new SpecBindError(`Series column "${spec.series}" is not in the table.`)
  }
  if (series && (series === x || y.includes(series))) {
    throw new SpecBindError('Series column must be distinct from x and y.')
  }

  const pieLike = spec.type === 'pie' || spec.type === 'donut'
  if (pieLike && y.length !== 1) {
    throw new SpecBindError('Pie and donut charts need a single numeric column.')
  }
  if (spec.type === 'scatter' && y.length < 1) {
    throw new SpecBindError('Scatter needs a numeric y column.')
  }

  return {
    ...spec,
    x,
    y,
    series: series ?? undefined,
    xLabel: spec.xLabel === spec.x ? x : spec.xLabel,
    yLabel: spec.yLabel,
  }
}

export function parseAndBind(table: ParsedTable, raw: unknown): ChartSpec {
  const parsed = ChartSpecSchema.parse(raw)
  return bindSpec(table, parsed)
}
