export function extractJson(text: string): unknown {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('Model returned an empty string.')

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = (fence?.[1] ?? trimmed).trim()

  const attempts = [body]
  const firstBrace = body.indexOf('{')
  const lastBrace = body.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    attempts.push(body.slice(firstBrace, lastBrace + 1))
  }

  let lastError: unknown
  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate)
    } catch (error) {
      lastError = error
    }
  }

  const repaired = body
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
  const start = repaired.indexOf('{')
  const end = repaired.lastIndexOf('}')
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(repaired.slice(start, end + 1))
    } catch (error) {
      lastError = error
    }
  }

  const message = lastError instanceof Error ? lastError.message : 'JSON.parse failed'
  throw new Error(`Could not extract a JSON object (${message}).`)
}
