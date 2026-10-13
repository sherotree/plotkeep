import { describe, expect, it } from 'vitest'
import { coerceNumber, looksTabular, parseSpreadsheet } from './csv'

describe('parseSpreadsheet', () => {
  it('parses CSV with a header and currency', () => {
    const table = parseSpreadsheet(`month,invoiced
Jan,"$4,200"
Feb,3100`)
    expect(table.columns.map((c) => c.name)).toEqual(['month', 'invoiced'])
    expect(table.columns[1]?.kind).toBe('number')
    expect(table.rows[0]?.invoiced).toBe(4200)
    expect(table.rows[0]?.month).toBe('Jan')
  })

  it('parses tab-separated spreadsheet paste', () => {
    const table = parseSpreadsheet('client\thours\nNorthwind\t18.5\nBirch\t12')
    expect(table.delimiter).toBe('\\t')
    expect(table.rows[1]?.hours).toBe(12)
  })

  it('parses quoted commas', () => {
    const table = parseSpreadsheet('name,note\n"Harbor, CPA",9.5')
    expect(table.rows[0]?.name).toBe('Harbor, CPA')
    expect(table.rows[0]?.note).toBe(9.5)
  })

  it('rejects a single line', () => {
    expect(() => parseSpreadsheet('month,invoiced')).toThrow(/one data row/)
  })
})

describe('looksTabular', () => {
  it('accepts CSV and rejects prose', () => {
    expect(looksTabular('a,b\n1,2')).toBe(true)
    expect(looksTabular('Show me monthly invoices as a line chart')).toBe(false)
  })
})

describe('coerceNumber', () => {
  it('handles currency, percent, and accounting negatives', () => {
    expect(coerceNumber('$1,234.50')).toBe(1234.5)
    expect(coerceNumber('(200)')).toBe(-200)
    expect(coerceNumber('18.5%')).toBe(18.5)
  })
})
