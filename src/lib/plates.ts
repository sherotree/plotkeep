import type { ParsedTable } from './csv'
import type { ChartSpec } from './schema'

export type Plate = {
  id: string
  name: string
  savedAt: string
  table: ParsedTable
  spec: ChartSpec
  sourceNote: string
}

const KEY = 'plotkeep.plates.v1'

export function loadPlates(): Plate[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Plate[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function savePlate(plate: Omit<Plate, 'id' | 'savedAt'>): Plate[] {
  const next: Plate = {
    ...plate,
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
  }
  const plates = [next, ...loadPlates()].slice(0, 24)
  localStorage.setItem(KEY, JSON.stringify(plates))
  return plates
}

export function deletePlate(id: string): Plate[] {
  const plates = loadPlates().filter((plate) => plate.id !== id)
  localStorage.setItem(KEY, JSON.stringify(plates))
  return plates
}
