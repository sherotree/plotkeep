export type Cell = string | number
export type Row = Record<string, Cell>
export type ColumnKind = 'number' | 'string' | 'date'

export type Column = {
  name: string
  kind: ColumnKind
}

export type ParsedTable = {
  columns: Column[]
  rows: Row[]
  delimiter: string
  warnings: string[]
}

const DATE_RE =
  /^(?:\d{4}[-/]\d{1,2}(?:[-/]\d{1,2})?|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:\s+\d{2,4})?|q[1-4](?:\s*['’]?\s*\d{2,4})?|\d{4})$/i

export function looksTabular(text: string): boolean {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
  if (lines.length < 2) return false
  const delimiter = detectDelimiter(lines.slice(0, 8).join('\n'))
  if (!delimiter) return false
  const widths = lines.slice(0, 12).map((line) => splitLine(line, delimiter).length)
  const first = widths[0] ?? 0
  if (first < 2) return false
  const similar = widths.filter((width) => Math.abs(width - first) <= 1).length
  return similar / widths.length >= 0.7
}

export function detectDelimiter(text: string): string | null {
  const sample = text
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .slice(0, 8)
  if (sample.length === 0) return null
  const candidates = ['\t', ',', ';', '|'] as const
  let best: { delimiter: string; score: number } | null = null
  for (const delimiter of candidates) {
    const widths = sample.map((line) => splitLine(line, delimiter).length)
    const first = widths[0] ?? 0
    if (first < 2) continue
    const consistent = widths.every((width) => Math.abs(width - first) <= 1)
    if (!consistent) continue
    const score = first * 10 + (delimiter === '\t' ? 3 : 0)
    if (!best || score > best.score) best = { delimiter, score }
  }
  return best?.delimiter ?? null
}

export function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (char === delimiter && !inQuotes) {
      out.push(current)
      current = ''
      continue
    }
    current += char
  }
  out.push(current)
  return out.map((cell) => cell.trim())
}

export function coerceNumber(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '' || trimmed === '—' || trimmed === '-') return null
  let sign = 1
  let body = trimmed
  if (/^\(.*\)$/.test(body)) {
    sign = -1
    body = body.slice(1, -1)
  }
  const percent = body.endsWith('%')
  body = body.replace(/%$/, '')
  const currency = body.replace(/[$€£¥₹\s]/g, '')
  // 1,234.56
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(currency) || /^-?\d+(\.\d+)?$/.test(currency)) {
    const n = Number(currency.replace(/,/g, ''))
    if (!Number.isFinite(n)) return null
    return sign * (percent ? n : n)
  }
  // 1.234,56
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(currency) || /^-?\d+,\d+$/.test(currency)) {
    const n = Number(currency.replace(/\./g, '').replace(',', '.'))
    if (!Number.isFinite(n)) return null
    return sign * n
  }
  return null
}

export function looksDate(value: string): boolean {
  return DATE_RE.test(value.trim())
}

function uniqueName(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base)
    return base
  }
  let i = 2
  while (used.has(`${base}_${i}`)) i += 1
  const name = `${base}_${i}`
  used.add(name)
  return name
}

export function inferKind(values: string[]): ColumnKind {
  const filled = values.map((v) => v.trim()).filter((v) => v !== '')
  if (filled.length === 0) return 'string'
  const numericHits = filled.filter((v) => coerceNumber(v) !== null).length
  const dateHits = filled.filter((v) => looksDate(v)).length
  if (numericHits / filled.length >= 0.7) return 'number'
  if (dateHits / filled.length >= 0.7) return 'date'
  return 'string'
}

export function tableFromMatrix(headerCells: string[], body: string[][]): ParsedTable {
  const warnings: string[] = []
  const used = new Set<string>()
  const names = headerCells.map((raw, index) => {
    const cleaned = raw.replace(/^\uFEFF/, '').trim() || `column_${index + 1}`
    return uniqueName(cleaned, used)
  })
  const width = names.length
  const columns: Column[] = names.map((name, colIndex) => {
    const values = body.map((row) => row[colIndex] ?? '')
    return { name, kind: inferKind(values) }
  })
  const rows: Row[] = body.map((rawRow) => {
    const row: Row = {}
    for (let i = 0; i < width; i += 1) {
      const col = columns[i]
      const raw = rawRow[i] ?? ''
      if (col.kind === 'number') {
        const n = coerceNumber(raw)
        row[col.name] = n === null ? '' : n
        if (raw.trim() && n === null) {
          warnings.push(`Could not parse "${raw}" in ${col.name} as a number.`)
        }
      } else {
        row[col.name] = raw
      }
    }
    return row
  })
  return {
    columns,
    rows,
    delimiter: ',',
    warnings: [...new Set(warnings)].slice(0, 8),
  }
}

export function parseSpreadsheet(text: string): ParsedTable {
  const trimmed = text.replace(/^\uFEFF/, '').trim()
  if (!trimmed) {
    throw new Error('Paste a table first — CSV, TSV, or cells copied from a spreadsheet.')
  }
  const delimiter = detectDelimiter(trimmed)
  if (!delimiter) {
    throw new Error('Could not detect columns. Use commas, tabs, or semicolons, with a header row.')
  }
  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim().length > 0)
  const header = splitLine(lines[0] ?? '', delimiter)
  const body = lines.slice(1).map((line) => splitLine(line, delimiter))
  if (body.length === 0) {
    throw new Error('Need at least one data row under the header.')
  }
  const table = tableFromMatrix(header, body)
  table.delimiter = delimiter === '\t' ? '\\t' : delimiter
  return table
}

export function tableToCsv(table: ParsedTable): string {
  const escape = (value: Cell) => {
    const s = String(value)
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const header = table.columns.map((c) => escape(c.name)).join(',')
  const lines = table.rows.map((row) => table.columns.map((c) => escape(row[c.name] ?? '')).join(','))
  return [header, ...lines].join('\n')
}

export function uniqueValues(table: ParsedTable, column: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const row of table.rows) {
    const value = String(row[column] ?? '')
    if (!seen.has(value)) {
      seen.add(value)
      out.push(value)
    }
  }
  return out
}
