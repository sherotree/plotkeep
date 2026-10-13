import { bindSpec, parseAndBind, SpecBindError } from './bindSpec'
import { tableFromMatrix, type ParsedTable } from './csv'
import { extractJson } from './extractJson'
import { withGroundedInsight } from './heuristic'
import { followupPrompt, proseBundlePrompt, repairPrompt, specPrompt } from './prompt'
import {
  ChartSpecSchema,
  GeneratedBundleSchema,
  normalizeSpec,
  type ChartSpec,
} from './schema'
import type { ChatMessage } from './engine'

export type CompleteFn = (messages: ChatMessage[]) => Promise<string>

export type ModelResult = {
  spec: ChartSpec
  table: ParsedTable
  attempts: number
  raw: string
}

async function completeWithRepair(
  complete: CompleteFn,
  initial: string,
  validate: (raw: unknown, text: string) => ChartSpec,
): Promise<{ spec: ChartSpec; attempts: number; raw: string }> {
  const messages: ChatMessage[] = [{ role: 'user', content: initial }]
  let lastError = 'Unknown validation error'
  let lastRaw = ''
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const raw = await complete(messages)
    lastRaw = raw
    try {
      const json = extractJson(raw)
      const spec = validate(json, raw)
      return { spec, attempts: attempt, raw }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
      messages.push({ role: 'assistant', content: raw })
      messages.push({ role: 'user', content: repairPrompt(lastError) })
    }
  }
  throw new SpecBindError(`Model output failed validation after 3 attempts: ${lastError}\n\nLast reply:\n${lastRaw.slice(0, 500)}`)
}

export async function specFromTable(
  table: ParsedTable,
  request: string,
  complete: CompleteFn,
): Promise<ModelResult> {
  const result = await completeWithRepair(complete, specPrompt(table, request), (json) => {
    const spec = parseAndBind(table, json)
    return withGroundedInsight(table, spec)
  })
  return { ...result, table }
}

export async function specFromFollowup(
  table: ParsedTable,
  spec: ChartSpec,
  instruction: string,
  complete: CompleteFn,
): Promise<ModelResult> {
  const result = await completeWithRepair(
    complete,
    followupPrompt(table, spec, instruction),
    (json) => withGroundedInsight(table, parseAndBind(table, json)),
  )
  return { ...result, table }
}

export async function bundleFromProse(request: string, complete: CompleteFn): Promise<ModelResult> {
  const result = await completeWithRepair(complete, proseBundlePrompt(request), (json) => {
    const bundle = GeneratedBundleSchema.parse(json)
    const body = bundle.table.rows.map((row) => bundle.table.columns.map((column) => String(row[column] ?? '')))
    const table = tableFromMatrix(bundle.table.columns, body)
    const spec = bindSpec(table, ChartSpecSchema.parse(bundle.spec))
    return withGroundedInsight(table, spec)
  })
  const bundle = GeneratedBundleSchema.parse(extractJson(result.raw))
  const body = bundle.table.rows.map((row) => bundle.table.columns.map((column) => String(row[column] ?? '')))
  return {
    ...result,
    table: tableFromMatrix(bundle.table.columns, body),
    spec: result.spec,
  }
}

export function previewSpec(spec: ChartSpec): string {
  return JSON.stringify(normalizeSpec(spec), null, 2)
}
