import { Link } from 'react-router-dom'
import { PRO_PRICE } from '../lib/pro'

export function Landing() {
  return (
    <div>
      <header className="mast">
        <div>
          <strong>Plotkeep</strong> · desk copy · not for the wire
        </div>
        <nav>
          <Link to="/studio">Open the press</Link>
        </nav>
      </header>

      <section className="hero">
        <div>
          <p className="kicker">Local charts for people who bill by the hour</p>
          <h1>A chart press that never phones home.</h1>
          <p className="lede">
            Paste a CSV, a spreadsheet clip, or a sentence about the table you wish you had.
            Plotkeep turns it into a validated chart spec and draws it with Apache ECharts. The
            table stays in this browser tab. Gemma, if you load it, runs on your GPU through
            WebLLM — or on localhost via Ollama. If neither is around, a deterministic fallback
            still draws the plate.
          </p>
          <div className="hero-actions">
            <Link className="btn" to="/studio">
              Open the press
            </Link>
            <a className="btn ghost" href="#pricing">
              Pro is {PRO_PRICE}, once
            </a>
            <span className="stamp">No egress</span>
          </div>
        </div>
        <aside className="plate-card" aria-hidden="true">
          <svg viewBox="0 0 360 220" role="presentation">
            <rect width="360" height="220" fill="#161310" />
            <text x="18" y="28" fill="#cbbfa6" fontFamily="IBM Plex Mono, monospace" fontSize="10">
              INVOICED · JAN–JUN
            </text>
            {[
              [48, 132, 58, '#c4a35a'],
              [98, 150, 40, '#3d5a45'],
              [148, 88, 102, '#8c2f1b'],
              [198, 118, 72, '#2c4a6e'],
              [248, 70, 120, '#a65d3a'],
              [298, 140, 50, '#5c4d7a'],
            ].map(([x, y, h, fill]) => (
              <rect key={String(x)} x={x} y={y} width="28" height={h} fill={String(fill)} />
            ))}
            <text x="18" y="208" fill="#cbbfa6" fontFamily="IBM Plex Mono, monospace" fontSize="9">
              MAY PEAK 6100 · LOCAL PLATE
            </text>
          </svg>
          <div className="plate-meta">
            <span>Sample · not uploaded</span>
            <span>ECharts · JSON spec</span>
          </div>
        </aside>
      </section>

      <section className="section">
        <hr className="rule" />
        <h2>Three passes, then ink.</h2>
        <div className="steps">
          <article className="step">
            <div className="num">01 · Paste</div>
            <h3>Desk copy in, as-is</h3>
            <p>
              CSV, TSV, or cells copied from Sheets/Excel. Or a plain sentence if you only have
              the shape of the question. Nothing is posted to a plotting API.
            </p>
          </article>
          <article className="step">
            <div className="num">02 · Spec</div>
            <h3>JSON, checked twice</h3>
            <p>
              Gemma (WebLLM or Ollama) proposes a chart spec. Zod validates it against the real
              columns. Invalid JSON is sent back for repair, up to three tries, then the
              heuristic engine takes over.
            </p>
          </article>
          <article className="step">
            <div className="num">03 · Plate</div>
            <h3>Draw, edit, export</h3>
            <p>
              Follow-up prompts retitle or change the type. Export PNG or SVG. After the first
              model download, the press keeps working offline — charts included.
            </p>
          </article>
        </div>
      </section>

      <section className="section who-pays">
        <div>
          <hr className="rule" />
          <h2>Who would pay for this</h2>
          <p>
            Not “everyone who likes charts.” A freelance operator who already has a laptop GPU,
            who pastes client names and invoice totals into tools that quietly POST the CSV, and
            who would rather buy a one-time license than rent a hosted inference meter. Bookkeepers
            doing aging reports. Analysts under an NDA who are not allowed to send the sheet to
            another vendor. The heuristic engine is the thing they can demo on a train; Gemma is
            the thing they turn on at the desk.
          </p>
          <p>
            This repo does not invent testimonials or conversion rates. It is a working press and
            a pricing shape: pay once, because you already paid for the silicon.
          </p>
        </div>
        <div>
          <p className="kicker">Offline after first fetch</p>
          <p>
            WebLLM caches weights in the browser. Self-hosted fonts ship in the bundle so the UI
            does not need Google Fonts at runtime. SharedArrayBuffer (hence Gemma in-tab) needs
            COOP/COEP headers — already set in Vite, <code>vercel.json</code>, and{' '}
            <code>public/_headers</code>.
          </p>
          <p>
            Swap the model id if you want a different open-weight chat model. The spec schema does
            not care which weights proposed it.
          </p>
        </div>
      </section>

      <section className="section" id="pricing">
        <hr className="rule" />
        <h2>License idea, not a checkout.</h2>
        <div className="tickets">
          <article className="ticket">
            <p className="kicker">Desk copy</p>
            <h3>Free</h3>
            <div className="price">$0</div>
            <p className="price-note">forever, this tab, this machine</p>
            <ul>
              <li>Unlimited charts from pasted tables</li>
              <li>Deterministic CSV fallback</li>
              <li>Optional local Gemma / Ollama</li>
              <li>PNG &amp; SVG at 1×</li>
            </ul>
          </article>
          <article className="ticket pro">
            <p className="kicker">Pro · honor system</p>
            <h3>Pro</h3>
            <div className="price">{PRO_PRICE}</div>
            <p className="price-note">one-time, per operator — no payment in this build</p>
            <ul>
              <li>Unlock with code PLOTKEEP-PRO to preview</li>
              <li>Saved plates in localStorage (this browser)</li>
              <li>2× / 3× PNG export</li>
              <li>Intended: lifetime, extra personal machines allowed</li>
            </ul>
          </article>
        </div>
      </section>

      <footer className="colophon">
        <hr className="rule" />
        <p>
          Plotkeep is original software for the DEV Hacktoberfest Open-Source AI Challenge, Week
          2 (Side Hustle). Prize category aimed at: Best Use of Gemma. Built with Vite, React,
          TypeScript, Zod, Apache ECharts, and @mlc-ai/web-llm. Gemma weights are used under the{' '}
          <a href="https://ai.google.dev/gemma/terms">Gemma Terms of Use</a>. Fraunces, Libre
          Franklin, and IBM Plex Mono are SIL Open Font License. See the README for the full
          credit list.
        </p>
      </footer>
    </div>
  )
}
