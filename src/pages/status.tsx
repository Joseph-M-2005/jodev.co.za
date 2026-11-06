import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/index.css'
import Layout from '../components/Layout'
import ExternalLink from '../components/ExternalLink'

const REPO = 'https://github.com/Joseph-M-2005/jodev.co.za'

// Shape of GET /api/status (status.ts publicData)
type Outcome = 'live' | 'rolled_back' | 'drill' | 'stopped' | 'rollback_failed'
type Deploy = { at: string; sha: string; outcome: Outcome; runUrl: string }
type Check = { at: string; ok: boolean; ms: number | null }
type Window = { ok: number; total: number }
type Data = { deploys: Deploy[]; uptime: { day: Window; week: Window; month: Window }; checks: Check[] }

// Status colour (on the mark only, never the text) plus an icon and a label, so it never rests on colour alone
const OUTCOMES: Record<Outcome, { icon: string; label: string }> = {
  live: { icon: '✓', label: 'Live' },
  drill: { icon: '↺', label: 'Fire drill, rolled back' },
  rolled_back: { icon: '↺', label: 'Rolled back' },
  stopped: { icon: '■', label: 'Stopped before going live' },
  rollback_failed: { icon: '✕', label: 'Rollback failed' },
}

const TILES = [
  { key: 'day', label: 'Last 24 hours' },
  { key: 'week', label: 'Last 7 days' },
  { key: 'month', label: 'Last 30 days' },
] as const

// Times in South Africa, where I am
const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg' })

// 100% only when nothing failed; otherwise one decimal, so 99.97% never rounds up to look perfect
const percent = ({ ok, total }: Window) => (ok === total ? '100%' : `${(Math.floor((ok / total) * 1000) / 10).toFixed(1)}%`)

const SLOTS = 48
const SLOT_MS = 30 * 60_000

// The last 24 hours as 48 half-hour slots, newest last. A slot with no check stays empty (GitHub ran late).
function slots(checks: Check[], now: number): (Check | null)[] {
  const out: (Check | null)[] = Array(SLOTS).fill(null)
  for (const c of checks) {
    const i = SLOTS - 1 - Math.floor((now - Date.parse(c.at)) / SLOT_MS)
    // A down check wins its slot, so an outage is never hidden by a later good check in the same half hour
    if (i >= 0 && i < SLOTS && (!out[i] || !c.ok)) out[i] = c
  }
  return out
}

const describe = (c: Check) => `${when(c.at)}: ${c.ok ? 'up' : 'down'}${c.ms === null ? '' : `, ${c.ms} ms`}`
// The same, for the page: times and numbers in the heading font, since Pixelify's small digits are hard to tell apart
const Line = ({ c }: { c: Check }) => (
  <>
    <span className="stat-date">{when(c.at)}</span>, {c.ok ? 'up' : 'down'}
    {c.ms !== null && <>, <span className="stat-date">{c.ms} ms</span></>}
  </>
)

function Strip({ checks }: { checks: Check[] }) {
  const [now] = useState(Date.now)
  const cells = slots(checks, now)
  const [active, setActive] = useState<number>()
  const latest = checks.at(-1)
  const shown = active === undefined ? undefined : cells[active]
  const down = checks.filter((c) => !c.ok).length

  return (
    <figure className="checks">
      <figcaption className="flow-label">Checks in the last 24 hours, oldest first</figcaption>
      <ol className="check-strip" onMouseLeave={() => setActive(undefined)}>
        {cells.map((c, i) => (
          <li
            key={i}
            className={c ? (c.ok ? 'check up' : 'check down') : 'check none'}
            tabIndex={0}
            aria-label={c ? describe(c) : 'No check in this half hour'}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(undefined)}
          />
        ))}
      </ol>
      {/* The hovered or focused slot, or the latest check */}
      <p className="check-readout" aria-live="polite">
        {active !== undefined
          ? shown
            ? <Line c={shown} />
            : 'No check in this half hour'
          : latest
            ? <>Latest check <Line c={latest} />. {down ? `${down} down in the last 24 hours.` : 'No downtime in the last 24 hours.'}</>
            : 'No checks yet.'}
      </p>
      <ul className="check-key" aria-hidden="true">
        <li><span className="check up" /> Up</li>
        <li><span className="check down" /> Down</li>
        <li><span className="check none" /> No check</li>
      </ul>
    </figure>
  )
}

function Status() {
  const [data, setData] = useState<Data>()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    // Plain `npm run dev` has no Worker, so this fails there and shows the fallback line
    fetch('/api/status')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then(setData, () => setFailed(true))
  }, [])

  return (
    <section className="section status">
      <div className="container">
        <a className="btn-raised back" href="/"><span aria-hidden="true">&lt; </span>Back</a>
        <p className="kicker">Status</p>
        <h1>Site <span className="nowrap">status<span className="cursor" aria-hidden="true" /></span></h1>
        <p className="lead">
          Every release of this site and how it went, plus uptime. About every 30 minutes GitHub runs the same tests a
          release has to pass against the live site, and the result lands here.
        </p>

        {failed ? (
          <p className="note">Couldn't load the status right now.</p>
        ) : (
          <div aria-busy={!data}>
            <h2 className="status-heading">Uptime</h2>
            <ul className="grid strava-grid">
              {TILES.map(({ key, label }) => {
                const w = data?.uptime[key]
                return (
                  <li key={key}>
                    <div className="card panel">
                      <span className="num">{label}</span>
                      <p className="stat">{!data ? '...' : w?.total ? percent(w) : '--'}</p>
                      {w && <p className="stat-note">{w.total ? `${w.ok} of ${w.total} checks passed` : 'No checks yet'}</p>}
                    </div>
                  </li>
                )
              })}
            </ul>

            {data && <Strip checks={data.checks} />}

            <h2 className="status-heading">Releases</h2>
            <p className="status-intro">
              Each row is one run of the <a href="/work">blue-green deploy</a>. A fire drill fails the live check on
              purpose, to prove the rollback still works.
            </p>
            {data && !data.deploys.length && <p className="note">No releases recorded yet.</p>}
            {!!data?.deploys.length && (
              <div className="table-scroll">
                <table className="deploys">
                  <thead>
                    <tr><th scope="col">When (SAST)</th><th scope="col">Commit</th><th scope="col">Outcome</th><th scope="col">Log</th></tr>
                  </thead>
                  <tbody>
                    {data.deploys.map((d) => (
                      <tr key={d.runUrl}>
                        <td className="stat-date">{when(d.at)}</td>
                        <td><ExternalLink href={`${REPO}/commit/${d.sha}`}><code>{d.sha.slice(0, 7)}</code></ExternalLink></td>
                        <td>
                          <span className={`outcome ${d.outcome}`}>
                            <span className="outcome-mark" aria-hidden="true">{OUTCOMES[d.outcome].icon}</span> {OUTCOMES[d.outcome].label}
                          </span>
                        </td>
                        <td><ExternalLink href={d.runUrl}>Run</ExternalLink></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Layout>
      <Status />
    </Layout>
  </StrictMode>,
)
