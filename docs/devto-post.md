---
title: "Plotkeep — a chart press that never phones home"
published: false
tags: hacktoberfest, webllm, gemma, privacy, typescript
canonical_url:
cover_image:
---

# Plotkeep — a chart press that never phones home

DEV Hacktoberfest Open-Source AI Challenge, Week 2 (Side Hustle).  
Prize category: **Best Use of Gemma**.

## What I built

**Plotkeep** is a static web app that turns a pasted table into a chart without sending the table anywhere.

You paste CSV, TSV, or cells copied from a spreadsheet — or a sentence if you only have the shape of the question. The app:

1. Parses the sheet in the tab (quoted fields, `$4,200`, European decimals, tab-separated paste).
2. Asks an open-weight **Gemma** model, running **on the device**, for a chart specification: type, encodings, title, one-or-two-sentence insight.
3. Validates that JSON with Zod against the **real column names**. If the model wraps the object in markdown, trails a comma, or invents a column called `value`, the error goes back to the model (up to three tries). After that, a deterministic heuristic draws anyway.
4. Renders with Apache ECharts. Export PNG or SVG. Follow-up prompts revise the spec (`make it a pie`, `title to "June collected"`).

The product name in the brief was ChartLocal. I called it Plotkeep because the job is not “charts, but local” — it is keeping the plate on the desk.

There is no account, no Plotkeep API, and no telemetry on the CSV. The only network the studio uses, if you opt in, is the first download of Gemma weights (WebLLM / Hugging Face) or a call to `127.0.0.1:11434` if you already run Ollama.

## Who would pay for this

A freelance operator who already bought a laptop with a GPU, who pastes **client names and invoice totals** into a chart generator, and who has noticed that “paste your CSV” often means “POST your CSV.”

That is a real irritation even if I am not going to invent a user interview. Aging reports, hours-by-client, a cafe’s Saturday SKUs — the sheet is small, the names are not public, and a $12/month hosted plotter is the wrong object. The silicon is already on the desk. Charging monthly for tokens the GPU can spend locally is a weird shape.

So the license idea is **$29 once**, per operator, extra personal machines allowed. This repo does not take payment. The Pro surfaces (saved plates in `localStorage`, 2×/3× PNG) unlock with the demo code `PLOTKEEP-PRO` so the paid edge is visible, not vapor. Free forever includes the heuristic engine, local Gemma, Ollama, and 1× export.

I am not claiming conversion rates. I am claiming the billing unit matches the cost structure: you pay for a press, not for inference.

## Demo

Repo: this project. Run:

```bash
npm install
npm run dev
```

Open `/studio`. The invoice sample is preloaded. **Draw chart** works with no model — that is deliberate. On this build it suggested a three-series line (`invoiced / collected / overdue by month`) and wrote “May leads invoiced at 6,100; Feb is the low at 3,100.” Load Gemma only if the browser has WebGPU and you can wait out a ~1.6 GB first fetch (cached after that). Screenshots of that flow live in [`docs/screenshots`](../docs/screenshots).

The screenshots below are real runs of Gemma 2 2B IT (`gemma-2-2b-it-q4f16_1-MLC-1k`) loaded in-tab via WebLLM, in Chrome on a Mac mini.

![Gemma 2 2B loaded in the tab](https://raw.githubusercontent.com/sherotree/plotkeep/main/docs/screenshots/gemma-loaded.png)

![Plain-English prompt drawn by Gemma](https://raw.githubusercontent.com/sherotree/plotkeep/main/docs/screenshots/gemma-prompt-bar.png)

![Freelancer CSV charted by Gemma](https://raw.githubusercontent.com/sherotree/plotkeep/main/docs/screenshots/gemma-csv.png)

![Gemma follow-up: line chart](https://raw.githubusercontent.com/sherotree/plotkeep/main/docs/screenshots/gemma-followup.png)

If you are on a machine without WebGPU, stay on the heuristic engine or point Ollama at `gemma2:2b`. The UI says which of those is true; it does not pretend a cloud fallback exists.

## How I built it

Stack: Vite, React, TypeScript, Zod, Apache ECharts, `@mlc-ai/web-llm`. Gemma 2 2B IT is the default WebLLM id (`gemma-2-2b-it-q4f16_1-MLC-1k`); Gemma 3 1B is on the menu for smaller VRAM. Gemma 2 has no system role, so instructions are folded into the first user turn.

The useful engineering is not the prompt. It is treating the model as an untrusted spec compiler:

- **Schema first.** The chart is a JSON object with `type`, `x`, `y`, optional `series`, `title`, `insight`. The table is *not* echoed back through the model. That keeps numbers honest and tokens short.
- **Bind, don’t trust.** Column names are resolved case-insensitively and with a little fuzzy match. Unknown fields fail closed.
- **Retries are boring and they work.** A 2B instruction model often returns “Sure, here is the JSON” plus a fence. `extractJson` peels that. Trailing commas get stripped. The next user turn is the Zod error, not a rewritten essay.
- **A fallback that is not a demo fake.** Date-like column + numbers → line. Short mix → pie. Two numeric columns and no labels → scatter. Insight is computed from max/min/share so the caption still names a real row when Gemma is absent or rambling. Follow-ups without a model understand type changes and quoted titles; they do not understand “emphasize March” — that is what the weights are for.
- **Offline after first fetch.** Fonts are Fontsource in the bundle (COEP would block Google Fonts anyway). WebLLM needs `COOP`/`COEP` for `SharedArrayBuffer`; Vite, `vercel.json`, and `public/_headers` set them. Weights cache in the browser. The heuristic path never needed a network.

I used ECharts instead of Vega-Lite because PNG/SVG export from a plate is a one-liner and the default dark plate looked like letterpress ink rather than a dashboard widget. That is a taste choice, not a moral one.

What is still thin: I did not fine-tune Gemma. The 1k-context build will choke if you paste a 200-column dump — the parser will accept it, the prompt truncates to 20 rows, and the spec may pick the wrong y. Pro is a localStorage flag, not Stripe. Ollama from a static host still needs `OLLAMA_ORIGINS`. Those are limits, not a backlog dressed up as vision.

## Why open innovation matters here

A hosted chart-from-CSV feature is easy, and it is also a copy of the sheet on someone else’s GPU. For this job that is the whole product risk.

Open weights change the economics in four concrete ways:

1. **Offline.** After the first Gemma download, a cafe Wi-Fi dropout does not stop an aging chart.
2. **Privacy.** The rows never become a training example at a plotting vendor, because they never arrive.
3. **Zero inference cost.** The meter is electricity you already bought. That is why the paid thing is a license, not a token pack.
4. **Swappable model.** The spec schema does not care whether WebLLM loaded Gemma 2 2B, Gemma 3 1B, or Ollama’s `gemma2:2b`. If a better open-weight JSON-follower shows up in `prebuiltAppConfig`, it is a dropdown.

Gemma is the right default for this challenge because it is small enough to contemplate in a tab (2B, or 1B if the laptop is modest) and instruction-tuned enough to emit a short JSON object when you show it the schema and an example. It is not reliable enough to skip validation. Plotkeep’s bet is that **validation plus a local model** is the product, not a chat window with a screenshot of a chart.

If you bill by the hour and you are tired of uploading the hour sheet to draw a bar, the press is at `/studio`.
