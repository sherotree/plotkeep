import { describe, expect, it } from 'vitest'
import { specFromTable } from './chartFromModel'
import { parseSpreadsheet } from './csv'

describe('specFromTable retries', () => {
  it('repairs invalid JSON on the second attempt', async () => {
    const table = parseSpreadsheet('month,invoiced\nJan,3\nFeb,5')
    let calls = 0
    const spec = await specFromTable(table, 'bar of invoiced', async () => {
      calls += 1
      if (calls === 1) return 'Here you go: not json'
      return JSON.stringify({
        type: 'bar',
        title: 'Invoiced by month',
        insight: 'Feb is the peak at 5.',
        x: 'month',
        y: 'invoiced',
        xLabel: 'Month',
        yLabel: 'USD',
      })
    })
    expect(calls).toBe(2)
    expect(spec.attempts).toBe(2)
    expect(spec.spec.type).toBe('bar')
    expect(spec.spec.x).toBe('month')
  })

  it('gives up after three bad replies', async () => {
    const table = parseSpreadsheet('month,invoiced\nJan,3')
    await expect(
      specFromTable(table, 'draw', async () => 'nope'),
    ).rejects.toThrow(/3 attempts/)
  })
})
