import { describe, expect, it } from 'vitest'
import { parseSpreadsheet } from './csv'
import { computeFacts, findContradiction, groundSpec, templatedInsight } from './facts'

const CSV = `month,client_a,client_b,client_c
2026-01,3200,1800,900
2026-02,3400,2100,1300
2026-03,3100,2300,1900
2026-04,3600,2600,2600
2026-05,3500,2900,3300
2026-06,3800,3100,4100`

describe('computeFacts', () => {
  it('computes per-series stats and the growth leader', () => {
    const table = parseSpreadsheet(CSV)
    const facts = computeFacts(table)!
    expect(facts.x).toBe('month')
    const c = facts.series.find((s) => s.name === 'client_c')!
    expect(c).toMatchObject({ first: 900, last: 4100, min: 900, max: 4100, maxLabel: '2026-06', change: 3200 })
    expect(Math.round(c.pctChange!)).toBe(356)
    const a = facts.series.find((s) => s.name === 'client_a')!
    expect(a).toMatchObject({ min: 3100, minLabel: '2026-03', max: 3800 })
    expect(facts.fastestGrowth).toBe('client_c')
    expect(facts.bestPeriod).toEqual({ label: '2026-06', value: 11000 })
    expect(facts.worstPeriod).toEqual({ label: '2026-01', value: 5900 })
  })

  it('handles a single series', () => {
    const facts = computeFacts(parseSpreadsheet('month,revenue\nJan,12\nFeb,15\nMar,9\nApr,18\nMay,21\nJun,17'))!
    expect(facts.fastestGrowth).toBeNull()
    expect(facts.bestPeriod).toEqual({ label: 'May', value: 21 })
    expect(templatedInsight(facts)).toBe('May is the peak at 21; Mar is the low at 9.')
  })
})

describe('findContradiction', () => {
  const table = parseSpreadsheet(CSV)
  const facts = computeFacts(table)!

  it('flags the wrong growth leader (Gemma client_b case)', () => {
    expect(findContradiction('Client B grew the most, increasing from 1800 to 2600.', facts, table)).toMatch(/client_c/)
  })
  it('flags numbers that are not in the data', () => {
    expect(findContradiction('client_c grew fastest, reaching 5200.', facts, table)).toMatch(/5200/)
  })
  it('accepts a correct claim', () => {
    expect(findContradiction('client_c grew fastest, from 900 to 4100 (+355.6%).', facts, table)).toBeNull()
    expect(findContradiction('Client C grew the most, up 3.2k since 2026-01.', facts, table)).toBeNull()
  })
  it('flags a wrong peak period', () => {
    const one = parseSpreadsheet('month,revenue\nJan,12\nFeb,15\nMar,9\nApr,18\nMay,21\nJun,17')
    expect(findContradiction('The best month was Apr at 18.', computeFacts(one)!, one)).toMatch(/peak/)
    expect(findContradiction('The best month was May with $21k.', computeFacts(one)!, one)).toBeNull()
  })
})

describe('groundSpec', () => {
  const table = parseSpreadsheet(CSV)
  const bad = {
    type: 'line' as const,
    title: 'Client Growth Over Time',
    insight: 'Client B grew the most, increasing from 1800 to 2600.',
    x: 'month',
    y: ['client_b'],
    xLabel: 'Month',
    yLabel: 'Client Value',
  }
  it('plots all series and replaces a contradicting insight', () => {
    const out = groundSpec(table, bad, 'which client grew fastest? pick the best chart')
    expect(out.spec.y).toEqual(['client_a', 'client_b', 'client_c'])
    expect(out.overridden).toBeTruthy()
    expect(out.spec.insight).toMatch(/^client_c grew fastest, from 900 in 2026-01 to 4100 in 2026-06/)
  })
  it('keeps a single series when the user asks for it', () => {
    const out = groundSpec(table, { ...bad, insight: 'client_b rose from 1800 to 3100.' }, 'only client_b')
    expect(out.spec.y).toEqual(['client_b'])
    expect(out.overridden).toBeNull()
  })
  it('turns a pie into a multi-series chart', () => {
    const out = groundSpec(table, { ...bad, type: 'pie', insight: 'client_c grew fastest.' }, '')
    expect(out.spec.type).toBe('line')
    expect(out.spec.y).toHaveLength(3)
  })
})
