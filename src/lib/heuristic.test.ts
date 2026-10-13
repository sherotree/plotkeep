import { describe, expect, it } from 'vitest'
import { parseSpreadsheet } from './csv'
import { applyFollowup } from './followup'
import { insightFor, suggestChart, syntheticFromProse } from './heuristic'
import { ChartSpecSchema, normalizeSpec } from './schema'
import { bindSpec } from './bindSpec'

describe('suggestChart', () => {
  it('picks a line for monthly money', () => {
    const table = parseSpreadsheet(`month,invoiced
Jan,4200
Feb,3100
Mar,5600`)
    const { spec } = suggestChart(table)
    expect(spec.type).toBe('line')
    expect(spec.x).toBe('month')
    expect(spec.y).toEqual(['invoiced'])
  })

  it('picks a pie for a short mix', () => {
    const table = parseSpreadsheet(`client,hours
Northwind,18
Birch,12
Harbor,9`)
    const { spec } = suggestChart(table)
    expect(spec.type).toBe('pie')
    expect(spec.insight).toMatch(/Northwind/)
  })

  it('does not plot hours against rate on one axis', () => {
    const table = parseSpreadsheet(`client,hours,rate
Northwind,18.5,95
Birch,12,110
Harbor,9.5,85`)
    const { spec, reason } = suggestChart(table)
    expect(spec.y).toEqual(['hours'])
    expect(spec.type).toBe('pie')
    expect(reason).toMatch(/hours/)
  })

  it('honors a pie hint on a longer table', () => {
    const table = parseSpreadsheet(`month,invoiced
Jan,1
Feb,2
Mar,3
Apr,4
May,5
Jun,6
Jul,7
Aug,8
Sep,9`)
    const { spec } = suggestChart(table, 'pie of invoiced')
    expect(spec.type).toBe('pie')
  })
})

describe('schema bind', () => {
  it('fuzzy-matches column names and rejects missing ones', () => {
    const table = parseSpreadsheet('Month,Invoiced\nJan,3')
    const spec = bindSpec(
      table,
      ChartSpecSchema.parse({
        type: 'bar',
        title: 'Invoices',
        insight: 'Jan is 3.',
        x: 'month',
        y: 'invoiced',
      }),
    )
    expect(spec.x).toBe('Month')
    expect(spec.y).toEqual(['Invoiced'])
    expect(() =>
      bindSpec(
        table,
        ChartSpecSchema.parse({
          type: 'bar',
          title: 'Invoices',
          insight: 'Nope.',
          x: 'client',
          y: 'hours',
        }),
      ),
    ).toThrow(/not in the table/)
  })
})

describe('followup', () => {
  it('switches type without a model', () => {
    const table = parseSpreadsheet('client,hours\nA,1\nB,2')
    const spec = normalizeSpec(
      ChartSpecSchema.parse({
        type: 'bar',
        title: 'Hours',
        insight: 'B is 2.',
        x: 'client',
        y: 'hours',
      }),
    )
    const next = applyFollowup(table, spec, 'make it a pie chart')
    expect(next.spec.type).toBe('pie')
    expect(next.unmatched).toBe(false)
  })
})

describe('prose fallback', () => {
  it('uses a sample instead of inventing a SaaS backend', () => {
    const { table, spec, reason } = syntheticFromProse('hours by client this week')
    expect(table.rows.length).toBeGreaterThan(2)
    expect(spec.y.length).toBeGreaterThan(0)
    expect(reason).toMatch(/sample/)
  })
})

describe('insight', () => {
  it('names the peak', () => {
    const table = parseSpreadsheet('month,n\nJan,2\nMar,9\nFeb,1')
    const spec = suggestChart(table).spec
    expect(insightFor(table, spec)).toMatch(/Mar/)
  })
})
