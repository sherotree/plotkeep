export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type EngineKind = 'webllm' | 'ollama'

export type LoadProgress = {
  progress: number
  text: string
}

export type WebGpuStatus = 'unknown' | 'available' | 'missing'

export const GEMMA_MODELS = [
  {
    id: 'gemma-2-2b-it-q4f16_1-MLC-1k',
    label: 'Gemma 2 2B IT · 1k context',
    blurb: 'Default for this build. ~1.6 GB download, lower VRAM than the 8k context build.',
    vram: '~1.6 GB',
  },
  {
    id: 'gemma-2-2b-it-q4f16_1-MLC',
    label: 'Gemma 2 2B IT · 8k context',
    blurb: 'Same weights family, longer context if the GPU has room.',
    vram: '~1.9 GB',
  },
  {
    id: 'gemma3-1b-it-q4f16_1-MLC',
    label: 'Gemma 3 1B IT',
    blurb: 'Smaller Gemma. Faster on modest laptops; weaker at following the JSON schema.',
    vram: '~0.7 GB',
  },
] as const

export type GemmaModelId = (typeof GEMMA_MODELS)[number]['id']

type CompletionsEngine = {
  chat: {
    completions: {
      create: (request: {
        messages: ChatMessage[]
        temperature?: number
        max_tokens?: number
      }) => Promise<{ choices: Array<{ message?: { content?: string | null } }> }>
    }
  }
}

let workerEngine: CompletionsEngine | null = null
let loadedModelId: string | null = null

export async function detectWebGpu(): Promise<WebGpuStatus> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu
  if (!gpu) return 'missing'
  try {
    const adapter = await gpu.requestAdapter()
    return adapter ? 'available' : 'missing'
  } catch {
    return 'missing'
  }
}

async function ollamaTags(url: string): Promise<string[]> {
  const response = await fetch(url, { signal: AbortSignal.timeout(1800) })
  if (!response.ok) throw new Error(`Ollama tags ${response.status}`)
  const body = (await response.json()) as { models?: Array<{ name?: string }> }
  return (body.models ?? []).map((model) => model.name).filter((name): name is string => Boolean(name))
}

export async function detectOllama(): Promise<{ ok: boolean; models: string[]; via: 'proxy' | 'direct' | null }> {
  const urls = [
    { href: '/ollama/api/tags', via: 'proxy' as const },
    { href: 'http://127.0.0.1:11434/api/tags', via: 'direct' as const },
  ]
  for (const url of urls) {
    try {
      const models = await ollamaTags(url.href)
      return { ok: models.length > 0, models, via: url.via }
    } catch {
      // try next
    }
  }
  return { ok: false, models: [], via: null }
}

export function pickOllamaModel(models: string[]): string | null {
  const gemma = models.find((name) => /gemma/i.test(name))
  return gemma ?? models[0] ?? null
}

export async function loadWebLlm(
  modelId: GemmaModelId,
  onProgress: (progress: LoadProgress) => void,
): Promise<void> {
  const { CreateWebWorkerMLCEngine } = await import('@mlc-ai/web-llm')
  const worker = new Worker(new URL('../workers/webllm.worker.ts', import.meta.url), { type: 'module' })
  const engine = await CreateWebWorkerMLCEngine(worker, modelId, {
    initProgressCallback: (report) => {
      onProgress({
        progress: report.progress,
        text: report.text,
      })
    },
  })
  workerEngine = engine
  loadedModelId = modelId
}

export function unloadWebLlm(): void {
  workerEngine = null
  loadedModelId = null
}

export function isWebLlmReady(): boolean {
  return workerEngine !== null
}

export function loadedWebLlmModel(): string | null {
  return loadedModelId
}

function flattenForGemma(messages: ChatMessage[]): ChatMessage[] {
  if (messages.some((message) => message.role === 'system')) {
    const system = messages.filter((message) => message.role === 'system').map((message) => message.content)
    const rest = messages.filter((message) => message.role !== 'system')
    if (rest[0]?.role === 'user') {
      return [
        { role: 'user', content: `${system.join('\n\n')}\n\n${rest[0].content}` },
        ...rest.slice(1),
      ]
    }
    return [{ role: 'user', content: system.join('\n\n') }, ...rest]
  }
  return messages
}

export async function completeWebLlm(messages: ChatMessage[]): Promise<string> {
  if (!workerEngine) throw new Error('Gemma is not loaded in this tab yet.')
  const response = await workerEngine.chat.completions.create({
    messages: flattenForGemma(messages),
    temperature: 0.2,
    max_tokens: 700,
  })
  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('Gemma returned an empty completion.')
  return content
}

export async function completeOllama(
  messages: ChatMessage[],
  model: string,
  via: 'proxy' | 'direct',
): Promise<string> {
  const href = via === 'proxy' ? '/ollama/api/chat' : 'http://127.0.0.1:11434/api/chat'
  const response = await fetch(href, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      format: 'json',
      options: { temperature: 0.1 },
    }),
  })
  if (!response.ok) {
    throw new Error(`Ollama ${response.status}: ${(await response.text()).slice(0, 180)}`)
  }
  const body = (await response.json()) as { message?: { content?: string } }
  const content = body.message?.content
  if (!content) throw new Error('Ollama returned an empty message.')
  return content
}
