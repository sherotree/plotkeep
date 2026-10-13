import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChartCanvas } from '../components/ChartCanvas.tsx'
import { bindSpec } from '../lib/bindSpec.ts'
import {
  bundleFromProse,
  specFromFollowup,
  specFromTable,
} from '../lib/chartFromModel.ts'
import { looksTabular, parseSpreadsheet, tableToCsv, type ParsedTable } from '../lib/csv.ts'
import { toEchartsOption } from '../lib/echartsOption.ts'
import {
  completeOllama,
  completeWebLlm,
  detectOllama,
  detectWebGpu,
  GEMMA_MODELS,
  isWebLlmReady,
  loadWebLlm,
  pickOllamaModel,
  type GemmaModelId,
  type WebGpuStatus,
} from '../lib/engine.ts'
import { exportChart } from '../lib/exportChart.ts'
import { applyFollowup } from '../lib/followup.ts'
import { insightFor, suggestChart, syntheticFromProse } from '../lib/heuristic.ts'
import { deletePlate, loadPlates, savePlate, type Plate } from '../lib/plates.ts'
import { isProUnlocked, lockPro, PRO_DEMO_KEY, unlockPro } from '../lib/pro.ts'
import { CHART_TYPES, type ChartSpec, type ChartType } from '../lib/schema.ts'
import { SAMPLES, sampleCsv } from '../lib/samples.ts'

type EngineChoice = 'heuristic' | 'webllm' | 'ollama'
type StatusNote = { kind: 'ok' | 'error' | 'info'; text: string }

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function Studio() {
  const [input, setInput] = useState(sampleCsv('invoices'))
  const [intent, setIntent] = useState('')
  const [followup, setFollowup] = useState('')
  const [table, setTable] = useState<ParsedTable | null>(null)
  const [spec, setSpec] = useState<ChartSpec | null>(null)
  const [note, setNote] = useState<StatusNote | null>(null)
  const [busy, setBusy] = useState(false)
  const [webgpu, setWebgpu] = useState<WebGpuStatus>('unknown')
  const [ollama, setOllama] = useState<{ ok: boolean; models: string[]; via: 'proxy' | 'direct' | null }>({
    ok: false,
    models: [],
    via: null,
  })
  const [engine, setEngine] = useState<EngineChoice>('heuristic')
  const [modelId, setModelId] = useState<GemmaModelId>(GEMMA_MODELS[0].id)
  const [ollamaModel, setOllamaModel] = useState('')
  const [loadProgress, setLoadProgress] = useState({ progress: 0, text: '' })
  const [gemmaReady, setGemmaReady] = useState(false)
  const [pro, setPro] = useState(false)
  const [proCode, setProCode] = useState('')
  const [plates, setPlates] = useState<Plate[]>([])
  const [attempts, setAttempts] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const gpu = await detectWebGpu()
      const local = await detectOllama()
      if (cancelled) return
      setWebgpu(gpu)
      setOllama(local)
      const picked = pickOllamaModel(local.models)
      if (picked) setOllamaModel(picked)
      setGemmaReady(isWebLlmReady())
      setPro(isProUnlocked())
      setPlates(loadPlates())
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const option = useMemo(() => (table && spec ? toEchartsOption(table, spec) : null), [table, spec])

  const complete = useCallback(
    async (messages: Parameters<typeof completeWebLlm>[0]) => {
      if (engine === 'webllm') return completeWebLlm(messages)
      if (engine === 'ollama') {
        if (!ollama.via || !ollamaModel) throw new Error('Ollama is not reachable from this tab.')
        return completeOllama(messages, ollamaModel, ollama.via)
      }
      throw new Error('Heuristic engine does not call a model.')
    },
    [engine, ollama.via, ollamaModel],
  )

  const draw = useCallback(async () => {
    setBusy(true)
    setNote(null)
    try {
      const text = input.trim()
      if (!text) throw new Error('Paste a table or a short description first.')
      const wantModel = engine !== 'heuristic'
      if (looksTabular(text)) {
        const parsed = parseSpreadsheet(text)
        if (wantModel) {
          try {
            const result = await specFromTable(parsed, intent, complete)
            setTable(result.table)
            setSpec(result.spec)
            setAttempts(result.attempts)
            setNote({
              kind: 'ok',
              text: `${engine === 'webllm' ? modelId : ollamaModel} · ${result.attempts} attempt${result.attempts === 1 ? '' : 's'} · columns left on device${factsNote(result.factsOverride)}`,
            })
            return
          } catch (error) {
            const fallback = suggestChart(parsed, intent)
            setTable(parsed)
            setSpec(fallback.spec)
            setAttempts(0)
            setNote({
              kind: 'error',
              text: `Model failed (${formatError(error)}). Drew the heuristic plate instead: ${fallback.reason}`,
            })
            return
          }
        }
        const fallback = suggestChart(parsed, intent)
        setTable(parsed)
        setSpec(fallback.spec)
        setAttempts(0)
        setNote({ kind: 'ok', text: `Heuristic · ${fallback.reason}` })
        return
      }

      if (wantModel) {
        try {
          const result = await bundleFromProse(intent || text, complete)
          setInput(tableToCsv(result.table))
          setTable(result.table)
          setSpec(result.spec)
          setAttempts(result.attempts)
          setNote({
            kind: 'ok',
            text: `Prose → table from ${engine === 'webllm' ? 'Gemma' : 'Ollama'} · ${result.attempts} attempt${result.attempts === 1 ? '' : 's'}${factsNote(result.factsOverride)}`,
          })
          return
        } catch (error) {
          const synth = syntheticFromProse(text)
          setInput(tableToCsv(synth.table))
          setTable(synth.table)
          setSpec(synth.spec)
          setNote({
            kind: 'error',
            text: `Model failed (${formatError(error)}). ${synth.reason}`,
          })
          return
        }
      }
      const synth = syntheticFromProse(text)
      setInput(tableToCsv(synth.table))
      setTable(synth.table)
      setSpec(synth.spec)
      setNote({ kind: 'ok', text: synth.reason })
    } catch (error) {
      setNote({ kind: 'error', text: formatError(error) })
    } finally {
      setBusy(false)
    }
  }, [complete, engine, input, intent, modelId, ollamaModel])

  const runFollowup = useCallback(async () => {
    if (!table || !spec) {
      setNote({ kind: 'error', text: 'Draw a chart before editing it.' })
      return
    }
    const instruction = followup.trim()
    if (!instruction) return
    setBusy(true)
    try {
      if (engine === 'heuristic') {
        const next = applyFollowup(table, spec, instruction)
        if (next.unmatched) {
          setNote({
            kind: 'error',
            text: 'Heuristic follow-ups understand type changes and quoted titles. Load Gemma for richer edits.',
          })
          return
        }
        setSpec(next.spec)
        setNote({ kind: 'ok', text: `Heuristic edit · ${next.applied.join('; ')}` })
        setFollowup('')
        return
      }
      try {
        const result = await specFromFollowup(table, spec, instruction, complete)
        setSpec(result.spec)
        setAttempts(result.attempts)
        setNote({ kind: 'ok', text: `Follow-up applied in ${result.attempts} attempt${result.attempts === 1 ? '' : 's'}${factsNote(result.factsOverride)}.` })
        setFollowup('')
      } catch (error) {
        const next = applyFollowup(table, spec, instruction)
        if (!next.unmatched) {
          setSpec(next.spec)
          setNote({
            kind: 'error',
            text: `Model follow-up failed (${formatError(error)}). Applied a keyword edit: ${next.applied.join('; ')}`,
          })
          setFollowup('')
          return
        }
        setNote({ kind: 'error', text: formatError(error) })
      }
    } finally {
      setBusy(false)
    }
  }, [complete, engine, followup, spec, table])

  async function onLoadGemma() {
    setBusy(true)
    setNote({ kind: 'info', text: 'Loading Gemma into this tab. First download is large; later visits use the cache.' })
    try {
      await loadWebLlm(modelId, setLoadProgress)
      setGemmaReady(true)
      setEngine('webllm')
      setNote({ kind: 'ok', text: `${modelId} is ready. Tables still never leave the tab.` })
    } catch (error) {
      setNote({ kind: 'error', text: `Could not load WebLLM: ${formatError(error)}` })
    } finally {
      setBusy(false)
    }
  }

  function onType(next: ChartType) {
    if (!table || !spec) return
    const pieLike = next === 'pie' || next === 'donut'
    const y = pieLike ? spec.y.slice(0, 1) : spec.y
    const updated = bindSpec(table, {
      ...spec,
      type: next,
      y,
      series: pieLike ? undefined : spec.series,
      yLabel: y.join(', '),
    })
    setSpec({ ...updated, insight: insightFor(table, updated) })
  }

  function onExport(format: 'png' | 'svg', scale: number) {
    if (!option || !spec) return
    if (scale > 1 && !pro) {
      setNote({ kind: 'error', text: '2×/3× PNG is a Pro preview. Unlock with PLOTKEEP-PRO, or export 1× for free.' })
      return
    }
    exportChart(option, format, spec.title, scale)
  }

  function onSavePlate() {
    if (!pro) {
      setNote({ kind: 'error', text: 'Saved plates are a Pro preview in this build.' })
      return
    }
    if (!table || !spec) return
    setPlates(
      savePlate({
        name: spec.title,
        table,
        spec,
        sourceNote: note?.text ?? 'manual save',
      }),
    )
    setNote({ kind: 'ok', text: 'Plate saved in this browser only.' })
  }

  return (
    <div className="studio">
      <header className="studio-bar">
        <Link className="brand" to="/">
          Plotkeep
        </Link>
        <div className="bar-meta">
          <span className={webgpu === 'available' ? 'pill live' : 'pill warn'}>
            WebGPU {webgpu}
          </span>
          <span className={ollama.ok ? 'pill live' : 'pill'}>
            Ollama {ollama.ok ? `· ${ollama.models.length} models` : 'off'}
          </span>
          <span className={gemmaReady ? 'pill live' : 'pill'}>
            {gemmaReady ? 'Gemma in-tab' : 'Gemma not loaded'}
          </span>
          <span className={engine === 'heuristic' ? 'pill' : 'pill live'}>{engine}</span>
          {pro ? <span className="stamp gold">Pro desk</span> : null}
        </div>
      </header>

      <div className="studio-grid">
        <aside className="dock">
          <p className="kicker">01 · Copy</p>
          <h2>Paste the table</h2>
          <p className="hint">
            CSV, TSV, or a sentence. The sheet is parsed here. Network is only used if you load
            Gemma weights or if Ollama is already running on this machine.
          </p>
          <div className="samples">
            {SAMPLES.map((sample) => (
              <button
                key={sample.id}
                className="chip"
                type="button"
                onClick={() => {
                  setInput(sample.csv)
                  setIntent('')
                }}
              >
                {sample.label}
              </button>
            ))}
          </div>
          <label className="field">
            Table or description
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              spellCheck={false}
              aria-label="Table or description"
            />
          </label>
          <label className="field">
            Optional intent
            <input
              type="text"
              value={intent}
              onChange={(event) => setIntent(event.target.value)}
              placeholder="e.g. pie of hours, hide overdue"
            />
          </label>
          <div className="row-actions">
            <button className="btn" type="button" onClick={() => void draw()} disabled={busy}>
              {busy ? 'Setting type…' : 'Draw chart'}
            </button>
            <label className="btn ghost small">
              Load CSV
              <input
                type="file"
                accept=".csv,.tsv,.txt"
                hidden
                onChange={async (event) => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  setInput(await file.text())
                }}
              />
            </label>
          </div>

          <hr className="rule" />
          <p className="kicker">Model</p>
          <h2>Gemma stays optional</h2>
          <p className="hint">
            Default path is the heuristic engine — it works on a phone, a VM, and a laptop with
            WebGPU blocked. Load Gemma when you want titles, mix calls, and follow-ups from the
            weights.
          </p>
          <label className="field">
            Engine
            <select
              value={engine}
              onChange={(event) => setEngine(event.target.value as EngineChoice)}
            >
              <option value="heuristic">Heuristic (no model)</option>
              <option value="webllm" disabled={!gemmaReady && webgpu !== 'available'}>
                WebLLM · Gemma in the tab
              </option>
              <option value="ollama" disabled={!ollama.ok}>
                Ollama · localhost
              </option>
            </select>
          </label>
          <label className="field">
            WebLLM weights
            <select
              value={modelId}
              onChange={(event) => setModelId(event.target.value as GemmaModelId)}
            >
              {GEMMA_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label} ({model.vram})
                </option>
              ))}
            </select>
          </label>
          {engine === 'webllm' || webgpu === 'available' ? (
            <button className="btn ghost" type="button" onClick={() => void onLoadGemma()} disabled={busy}>
              {gemmaReady ? 'Reload Gemma' : 'Load Gemma in this tab'}
            </button>
          ) : (
            <p className="hint">WebGPU missing — use Ollama or stay on heuristic.</p>
          )}
          {loadProgress.text ? (
            <>
              <div className="progress" aria-hidden="true">
                <span style={{ width: `${Math.round(loadProgress.progress * 100)}%` }} />
              </div>
              <p className="muted">{loadProgress.text}</p>
            </>
          ) : null}
          {ollama.ok ? (
            <label className="field">
              Ollama model
              <select value={ollamaModel} onChange={(event) => setOllamaModel(event.target.value)}>
                {ollama.models.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="muted">
              To use Ollama: <code>ollama pull gemma2:2b</code>, then{' '}
              <code>OLLAMA_ORIGINS=*</code> for static hosts. Dev server proxies{' '}
              <code>/ollama</code>.
            </p>
          )}
        </aside>

        <main className="stage">
          <div className="plate">
            <div className="plate-copy">
              <p className="kicker">02 · Plate {attempts ? `· ${attempts} model pass${attempts === 1 ? '' : 'es'}` : ''}</p>
              <h2>{spec?.title ?? 'No plate yet'}</h2>
              <p className="insight">
                {spec?.insight ?? 'Paste a table and draw. Title and insight land here.'}
              </p>
            </div>
            <ChartCanvas
              option={option}
              emptyHint="The plate is empty. Paste invoices, hours, or a SKU mix — or load a sample."
            />
          </div>
          {note ? <div className={note.kind === 'error' ? 'error' : 'ok'}>{note.text}</div> : null}
          <form
            className="follow"
            onSubmit={(event) => {
              event.preventDefault()
              void runFollowup()
            }}
          >
            <input
              type="text"
              value={followup}
              onChange={(event) => setFollowup(event.target.value)}
              placeholder="Follow-up: make it a pie, title to “June collected”"
              aria-label="Follow-up prompt"
            />
            <button className="btn" type="submit" disabled={busy || !spec}>
              Revise
            </button>
          </form>
        </main>

        <aside className="rail">
          <p className="kicker">03 · Spec</p>
          <h2>Validated JSON</h2>
          <p className="hint">Change the type without re-prompting. Export never uploads.</p>
          {spec && table ? (
            <>
              <label className="field">
                Chart type
                <select value={spec.type} onChange={(event) => onType(event.target.value as ChartType)}>
                  {CHART_TYPES.map((typeName) => (
                    <option key={typeName} value={typeName}>
                      {typeName}
                    </option>
                  ))}
                </select>
              </label>
              <p className="muted">
                x {spec.x} · y {spec.y.join(', ')}
                {spec.series ? ` · series ${spec.series}` : ''}
              </p>
              <div className="row-actions">
                <button className="btn small" type="button" onClick={() => onExport('png', 1)}>
                  PNG
                </button>
                <button className="btn small ghost" type="button" onClick={() => onExport('svg', 1)}>
                  SVG
                </button>
                <button className="btn small ghost" type="button" onClick={() => onExport('png', 2)}>
                  PNG 2×
                </button>
                <button className="btn small ghost" type="button" onClick={() => onExport('png', 3)}>
                  PNG 3×
                </button>
              </div>
              <pre className="json">{JSON.stringify(spec, null, 2)}</pre>
            </>
          ) : (
            <p className="hint">The spec inspector fills in after the first draw.</p>
          )}

          <hr className="rule" />
          <p className="kicker">Pro preview</p>
          <h2>Plates on this browser</h2>
          {pro ? (
            <>
              <div className="row-actions">
                <button className="btn small" type="button" onClick={onSavePlate} disabled={!spec}>
                  Save plate
                </button>
                <button
                  className="btn small ghost"
                  type="button"
                  onClick={() => {
                    lockPro()
                    setPro(false)
                  }}
                >
                  Lock Pro
                </button>
              </div>
              <ul className="plate-list">
                {plates.length === 0 ? <li className="muted">No saved plates yet.</li> : null}
                {plates.map((plate) => (
                  <li key={plate.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setTable(plate.table)
                        setSpec(plate.spec)
                        setInput(tableToCsv(plate.table))
                        setNote({ kind: 'ok', text: `Loaded “${plate.name}” from localStorage.` })
                      }}
                    >
                      <strong>{plate.name}</strong>
                      <span className="muted">{new Date(plate.savedAt).toLocaleString()}</span>
                    </button>
                    <button
                      className="chip"
                      type="button"
                      onClick={() => setPlates(deletePlate(plate.id))}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="pro-gate">
              <p className="hint">
                {PRO_DEMO_KEY} unlocks saved plates and 2×/3× PNG. No card, no server — the flag
                lives in localStorage.
              </p>
              <label className="field">
                License code
                <input
                  type="text"
                  value={proCode}
                  onChange={(event) => setProCode(event.target.value)}
                  placeholder={PRO_DEMO_KEY}
                />
              </label>
              <button
                className="btn small"
                type="button"
                onClick={() => {
                  if (unlockPro(proCode)) {
                    setPro(true)
                    setNote({ kind: 'ok', text: 'Pro preview unlocked on this browser.' })
                  } else {
                    setNote({ kind: 'error', text: `Use ${PRO_DEMO_KEY}. There is no payment processor here.` })
                  }
                }}
              >
                Unlock
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

function factsNote(override: string | null): string {
  return override
    ? ` · facts checked on device (model insight replaced: ${override})`
    : ' · facts checked on device'
}
