import { describe, expect, it } from 'vitest'
import { extractJson } from './extractJson'

describe('extractJson', () => {
  it('reads a fenced object and ignores chatter', () => {
    const json = extractJson('Sure.\n```json\n{"type":"bar","x":"month"}\n```\nHope that helps.')
    expect(json).toEqual({ type: 'bar', x: 'month' })
  })

  it('strips trailing commas', () => {
    const json = extractJson('{"type":"pie","x":"client",}')
    expect(json).toEqual({ type: 'pie', x: 'client' })
  })

  it('throws on empty', () => {
    expect(() => extractJson('   ')).toThrow(/empty/)
  })
})
