# Plotkeep

A privacy-first chart press for people who bill by the hour. Paste a CSV, a spreadsheet clip, or a short description. Plotkeep turns it into a **validated chart spec** (Zod JSON schema) and draws it with [Apache ECharts](https://echarts.apache.org/). The table never leaves the device.

Open-weight path: **Gemma** via [WebLLM / MLC](https://github.com/mlc-ai/web-llm) in the browser (WebGPU), with **Ollama on localhost** if WebGPU is missing. If neither is available, a deterministic heuristic still suggests a chart type, title, and insight so the app is usable on a VM, a phone, or a train.

Built for the DEV Hacktoberfest Open-Source AI Challenge, Week 2 (theme: Side Hustle). Prize category: **Best Use of Gemma**.

## Who it is for

Freelancers, bookkeepers, and analysts who paste client names, invoice totals, or hours into a chart tool and do not want that sheet posted to a hosted inference API. Plotkeep is the desk copy: local weights, local render, export PNG/SVG.

## Run locally

Requires Node 20+.

```bash
npm install
npm test
npm run dev
```

Open [http://127.0.0.1:4867](http://127.0.0.1:4867). The press is at `/studio`.

```bash
npm run build
npm run preview
```

Static deploy (any static host). For in-tab Gemma you must send isolation headers so `SharedArrayBuffer` works:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

This repo sets them in Vite, `vercel.json`, and `public/_headers` (Netlify / Cloudflare Pages).

### Optional: Gemma in the tab

1. Use a browser with WebGPU (current Chrome/Edge on a machine with a GPU).
2. In `/studio`, pick **Gemma 2 2B IT** (default, ~1.6 GB, cached after first download) or **Gemma 3 1B** if VRAM is tight.
3. Click **Load Gemma in this tab**. Progress is shown; later visits should hit the browser cache.

Gemma 2’s chat template has no system role. Plotkeep folds instructions into the first user turn.

### Optional: Ollama fallback

When WebGPU is missing:

```bash
ollama pull gemma2:2b
# static hosts need CORS; the Vite dev server proxies /ollama → 127.0.0.1:11434
OLLAMA_ORIGINS='http://127.0.0.1:4867,http://localhost:4867' ollama serve
```

Plotkeep prefers a locally installed Gemma-named model, then whatever Ollama lists.

## How it works

```
paste / file / sample
        │
        ▼
  looks tabular? ──yes──► CSV/TSV parser (quoted fields, $, tabs)
        │                         │
        no                        ▼
        │                  Zod chart spec
        ▼                         │
  prose path                      ├── WebLLM Gemma (retry ≤3)
        │                         ├── Ollama Gemma (retry ≤3)
        │                         └── heuristic (always available)
        ▼
  model may invent a small table
  or heuristic loads a built-in sample
        │
        ▼
   bind spec to real columns
   (fuzzy name match; reject unknown fields)
        │
        ▼
   ECharts plate → PNG / SVG
```

Invalid model JSON is extracted from fences, trailing commas stripped, then sent back with the Zod error. After three failures the heuristic draws anyway. Follow-up prompts revise the spec; without a model they still understand type changes and quoted titles (`make it a pie`, `title to "June collected"`).

## Pro license (idea, not a checkout)

There is no payment processor in this build.

| | Free | Pro · $29 one-time |
|---|---|---|
| Charts from pasted tables | yes | yes |
| Local Gemma / Ollama | yes | yes |
| PNG / SVG 1× | yes | yes |
| PNG 2× / 3× | locked | preview |
| Saved plates | — | localStorage, this browser |

Unlock the Pro surfaces with the demo code `PLOTKEEP-PRO`. The intended product shape is a lifetime honor-system license per operator, extra personal machines allowed — monthly inference billing is the wrong shape when the GPU already sits on the desk.

## Architecture

| Path | Role |
|---|---|
| `src/lib/csv.ts` | Spreadsheet parse, delimiter detect, number/date kinds |
| `src/lib/schema.ts` | Zod `ChartSpec` |
| `src/lib/bindSpec.ts` | Column bind + fuzzy match |
| `src/lib/heuristic.ts` | Chart type + grounded insight without a model |
| `src/lib/extractJson.ts` | Salvage JSON from model chatter |
| `src/lib/chartFromModel.ts` | Prompt → validate → retry |
| `src/lib/engine.ts` | WebGPU detect, WebLLM worker, Ollama |
| `src/lib/echartsOption.ts` | Spec → ECharts option |
| `src/workers/webllm.worker.ts` | MLC engine off the UI thread |
| `src/pages/Studio.tsx` | The press |
| `src/pages/Landing.tsx` | Product + pricing copy |

Tests: `npm test` (parser, schema bind, JSON salvage, retries, follow-ups).

## Open-source credits and licenses

| Piece | License | Notes |
|---|---|---|
| Plotkeep (this repo) | MIT | Original code, 2026 |
| [Gemma](https://ai.google.dev/gemma) 2 / 3 weights | [Gemma Terms of Use](https://ai.google.dev/gemma/terms) | Not bundled; downloaded by WebLLM or Ollama |
| [@mlc-ai/web-llm](https://github.com/mlc-ai/web-llm) | Apache-2.0 | In-browser MLC runtime |
| [Apache ECharts](https://echarts.apache.org/) | Apache-2.0 | Chart renderer |
| [Zod](https://zod.dev/) | MIT | Spec validation |
| [Vite](https://vitejs.dev/) + [React](https://react.dev/) | MIT | App shell |
| [Fraunces](https://github.com/undercasetype/Fraunces), [Libre Franklin](https://github.com/googlefonts/Libre-Franklin), [IBM Plex Mono](https://github.com/IBM/plex) | SIL OFL-1.1 | Self-hosted via Fontsource |

No chart data is sent to a Plotkeep server. There is no Plotkeep server. First-load model weights come from the MLC / Hugging Face URLs WebLLM already uses; after that they are cached by the browser.

## Screenshots

Taken from the running app with the heuristic engine (this capture machine has no WebGPU, so Gemma was not loaded — that is the fallback the product promises):

- [`docs/screenshots/landing_hero.png`](docs/screenshots/landing_hero.png) — landing and pricing
- [`docs/screenshots/studio_empty.png`](docs/screenshots/studio_empty.png) — empty plate
- [`docs/screenshots/studio_invoices_line.png`](docs/screenshots/studio_invoices_line.png) — invoice CSV → multi-series line
- [`docs/screenshots/studio_invoices_bar.png`](docs/screenshots/studio_invoices_bar.png) — type switched to bar
- [`docs/screenshots/studio_invoices_pie.png`](docs/screenshots/studio_invoices_pie.png) — type switched to pie
- [`docs/screenshots/studio_followup_horizontal.png`](docs/screenshots/studio_followup_horizontal.png) — follow-up `make it a horizontal-bar`
- [`docs/screenshots/studio_hours_mix.png`](docs/screenshots/studio_hours_mix.png) — hours by client as a pie
- [`docs/screenshots/studio_pro_unlocked.png`](docs/screenshots/studio_pro_unlocked.png) — Pro preview via `PLOTKEEP-PRO`
- [`docs/screenshots/studio_mobile.png`](docs/screenshots/studio_mobile.png) — narrow viewport

## Challenge write-up

Draft DEV post: [`docs/devto-post.md`](docs/devto-post.md).
