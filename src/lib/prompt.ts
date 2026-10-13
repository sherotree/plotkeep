import { tableToCsv, type ParsedTable } from './csv'
import { computeFacts, factsBlock } from './facts'
import { SPEC_JSON_SHAPE, type ChartSpec } from './schema'

function columnGuide(table: ParsedTable): string {
  return table.columns
    .map((column) => {
      const sample = table.rows
        .slice(0, 4)
        .map((row) => JSON.stringify(row[column.name] ?? ''))
        .join(', ')
      return `- ${column.name} (${column.kind}) e.g. ${sample}`
    })
    .join('\n')
}

export function specPrompt(table: ParsedTable, userRequest: string): string {
  const sample = tableToCsv({
    ...table,
    rows: table.rows.slice(0, 20),
  })
  const request = userRequest.trim() || 'Choose the simplest chart that makes the table readable.'
  const facts = computeFacts(table)
  const factsText = facts
    ? `\n\nFacts computed on device (ground truth, do not recompute):\n${factsBlock(facts)}`
    : ''
  return `You convert tables into a chart specification. Reply with a single JSON object. No markdown, no commentary.

Schema:
${SPEC_JSON_SHAPE}

Rules:
- Use only these column names: ${table.columns.map((c) => c.name).join(', ')}
- Do not invent rows or change numbers.
- insight must use ONLY the computed facts below (series names, periods, numbers). Never contradict them.
- Include every numeric column in y (as an array) unless the user request asks for specific columns.
- Prefer line for dates, pie/donut only for a short mix, scatter only for two numbers with no useful labels.

Example:
{"type":"bar","title":"Invoices by month","insight":"March is the peak at 5600.","x":"month","y":"invoiced","xLabel":"Month","yLabel":"USD"}

User request:
${request}

Columns:
${columnGuide(table)}

Sample rows (CSV, may be truncated):
${sample}${factsText}`
}

export function repairPrompt(errorMessage: string): string {
  return `That JSON failed validation: ${errorMessage}
Return a corrected JSON object only, same schema, using only existing column names. No markdown.`
}

export function followupPrompt(table: ParsedTable, spec: ChartSpec, instruction: string): string {
  return `Revise this chart specification. Reply with a full replacement JSON object, same schema. No markdown.

Current spec:
${JSON.stringify(spec, null, 2)}

Columns (only these exist): ${table.columns.map((c) => `${c.name}:${c.kind}`).join(', ')}

Instruction:
${instruction.trim()}

Keep numbers on the original table. Do not add rows. Keep the insight consistent with these facts:
${(() => {
  const facts = computeFacts(table)
  return facts ? factsBlock(facts) : '(none)'
})()}`
}

export function proseBundlePrompt(request: string): string {
  return `The user did not paste a table. Create a small realistic table (6 to 10 rows) AND a chart specification for it.

Reply with one JSON object, no markdown:
{
  "table": {
    "columns": ["name", "value"],
    "rows": [{"name": "A", "value": 1}]
  },
  "spec": ${SPEC_JSON_SHAPE}
}

Keep the story modest (freelance, cafe, or traffic). Numbers should be internally consistent.
User request:
${request.trim()}`
}
