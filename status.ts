// The /status page's data: every Deploy workflow run (live, rolled back, fire drill) and the Uptime workflow's checks.
// GitHub Actions writes the rows with `wrangler d1 execute` (scripts/status-record.ts); the Worker only ever reads them.
// No runtime imports, so the record script and the Node tests can load this file too.
import type { Ctx, D1 } from './strava'

// Shared by the Worker and the record script, so the tables are defined in one place
export const STATUS_SCHEMA = [
  'CREATE TABLE IF NOT EXISTS status_deploys (id INTEGER PRIMARY KEY, at TEXT NOT NULL, sha TEXT NOT NULL, green TEXT, blue TEXT, outcome TEXT NOT NULL, run_url TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS status_checks (at TEXT PRIMARY KEY, ok INTEGER NOT NULL, ms INTEGER)',
]

export const OUTCOMES = ['live', 'rolled_back', 'drill', 'stopped', 'rollback_failed'] as const
export type Outcome = (typeof OUTCOMES)[number]

// How a Deploy run ended, from what the workflow knows in its last step
export function outcomeOf(run: { success: boolean; switched: boolean; drill: boolean; blueCheckFailed: boolean }): Outcome {
  if (run.success) return 'live'
  // Failed before the switch: green never had any traffic
  if (!run.switched) return 'stopped'
  if (run.blueCheckFailed) return 'rollback_failed'
  return run.drill ? 'drill' : 'rolled_back'
}

const SHA = /^[0-9a-f]{40}$/
const VERSION = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const RUN_URL = /^https:\/\/github\.com\/Joseph-M-2005\/jodev\.co\.za\/actions\/runs\/\d+$/
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

export type DeployRow = { at: string; sha: string; green: string | null; blue: string | null; outcome: Outcome; runUrl: string }
export type CheckRow = { at: string; ok: boolean; ms: number | null }

// `wrangler d1 execute --command` takes no bound parameters, so every value is checked against a strict pattern
// before it goes into the SQL. Anything else throws.
export function deploySql(row: DeployRow): string {
  if (!ISO.test(row.at)) throw new Error(`bad time: ${row.at}`)
  if (!SHA.test(row.sha)) throw new Error(`bad sha: ${row.sha}`)
  for (const v of [row.green, row.blue]) if (v !== null && !VERSION.test(v)) throw new Error(`bad version id: ${v}`)
  if (!OUTCOMES.includes(row.outcome)) throw new Error(`bad outcome: ${row.outcome}`)
  if (!RUN_URL.test(row.runUrl)) throw new Error(`bad run URL: ${row.runUrl}`)
  const text = (v: string | null) => (v === null ? 'NULL' : `'${v}'`)
  return `INSERT INTO status_deploys (at, sha, green, blue, outcome, run_url) VALUES (${[row.at, row.sha, row.green, row.blue, row.outcome, row.runUrl].map(text).join(', ')})`
}

// One check, plus pruning anything older than 90 days so the table stays small
export function checkSql(row: CheckRow): string {
  if (!ISO.test(row.at)) throw new Error(`bad time: ${row.at}`)
  if (row.ms !== null && (!Number.isSafeInteger(row.ms) || row.ms < 0)) throw new Error(`bad ms: ${row.ms}`)
  const cutoff = new Date(Date.parse(row.at) - 90 * 86400_000).toISOString()
  return [
    `INSERT OR REPLACE INTO status_checks (at, ok, ms) VALUES ('${row.at}', ${row.ok ? 1 : 0}, ${row.ms ?? 'NULL'})`,
    `DELETE FROM status_checks WHERE at < '${cutoff}'`,
  ].join('; ')
}

// Created on first use in each isolate, like the Strava tables, so a fresh database reads as empty instead of failing
let ready: Promise<unknown> | undefined
const setup = (db: D1) =>
  (ready ??= db.batch(STATUS_SCHEMA.map((sql) => db.prepare(sql))).catch((err) => {
    ready = undefined
    throw err
  }))

const WINDOWS = { day: 1, week: 7, month: 30 }

// What the page shows: whitelisted columns only (no version ids)
async function publicData(db: D1, now = Date.now()) {
  await setup(db)
  const since = (days: number) => new Date(now - days * 86400_000).toISOString()
  const deploys = await db
    .prepare('SELECT at, sha, outcome, run_url FROM status_deploys ORDER BY at DESC LIMIT 20')
    .all<{ at: string; sha: string; outcome: Outcome; run_url: string }>()
  const checks = await db
    .prepare('SELECT at, ok, ms FROM status_checks WHERE at >= ? ORDER BY at')
    .bind(since(1))
    .all<{ at: string; ok: number; ms: number | null }>()
  const uptime: Record<string, { ok: number; total: number }> = {}
  for (const [name, days] of Object.entries(WINDOWS)) {
    const row = await db
      .prepare('SELECT COUNT(*) AS total, COALESCE(SUM(ok), 0) AS ok FROM status_checks WHERE at >= ?')
      .bind(since(days))
      .first<{ total: number; ok: number }>()
    uptime[name] = { ok: row?.ok ?? 0, total: row?.total ?? 0 }
  }
  return {
    deploys: deploys.results.map((d) => ({ at: d.at, sha: d.sha, outcome: d.outcome, runUrl: d.run_url })),
    uptime,
    checks: checks.results.map((c) => ({ at: c.at, ok: c.ok === 1, ms: c.ms })),
  }
}

const json = (body: object, status = 200, headers: HeadersInit = {}) => Response.json(body, { status, headers })
// Cloudflare's edge cache for this data centre, same as /api/strava, so page views hardly ever touch D1
const edge = () => (caches as unknown as { default: Cache }).default

// GET /api/status
export async function status(request: Request, env: { DB: D1 }, ctx: Ctx): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
  const url = new URL(request.url)
  const key = new Request(`${url.origin.replace('://www.', '://')}/api/status`)
  const hit = await edge().match(key)
  if (hit) return hit
  const res = json(await publicData(env.DB), 200, { 'Cache-Control': 'public, max-age=60' })
  ctx.waitUntil(edge().put(key, res.clone()))
  return res
}
