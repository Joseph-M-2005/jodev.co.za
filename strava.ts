// Strava Best Efforts and year-to-date stats for the About page. STRAVA.md explains the whole flow and the security model.

// Just the parts of D1 and the Worker runtime this file uses
interface D1Statement {
  bind(...values: unknown[]): D1Statement
  first<T>(): Promise<T | null>
  all<T>(): Promise<{ results: T[] }>
  run(): Promise<{ meta: { changes: number } }>
}
interface D1 {
  prepare(sql: string): D1Statement
  batch(statements: D1Statement[]): Promise<unknown>
}
export type Ctx = { waitUntil(promise: Promise<unknown>): void }

// All set with `wrangler secret put` (or .dev.vars locally). Anything missing switches that part off.
export interface StravaEnv {
  DB: D1
  STRAVA_LIMIT: { limit(options: { key: string }): Promise<{ success: boolean }> }
  STRAVA_CLIENT_ID?: string
  STRAVA_CLIENT_SECRET?: string
  STRAVA_REFRESH_TOKEN?: string
  STRAVA_TOKEN_KEY?: string
  STRAVA_WEBHOOK_SECRET?: string
  STRAVA_ATHLETE_ID?: string
  STRAVA_SUBSCRIPTION_ID?: string
  ADMIN_TOKEN?: string
}

type Config = { clientId: string; clientSecret: string; tokenKey: string; athleteId: number; bootstrapRefresh?: string }

// The settings every Strava call needs, or undefined so callers fail closed
function config(env: StravaEnv): Config | undefined {
  const athleteId = Number(env.STRAVA_ATHLETE_ID)
  if (!env.STRAVA_CLIENT_ID || !env.STRAVA_CLIENT_SECRET || !env.STRAVA_TOKEN_KEY || !Number.isSafeInteger(athleteId) || athleteId <= 0) return
  return { clientId: env.STRAVA_CLIENT_ID, clientSecret: env.STRAVA_CLIENT_SECRET, tokenKey: env.STRAVA_TOKEN_KEY, athleteId, bootstrapRefresh: env.STRAVA_REFRESH_TOKEN }
}

// The distances we track, in Strava's own metres. Matched by distance, not name, so Strava's labels ("5k", "Half-Marathon") don't matter.
export const EFFORTS = [
  { name: '5K', metres: 5000 },
  { name: '10K', metres: 10000 },
  { name: 'Half Marathon', metres: 21097.5 },
  { name: 'Marathon', metres: 42195 },
]
const RUNS = new Set(['Run', 'TrailRun', 'VirtualRun'])

export type Effort = { name: string; seconds: number; date: string; activityId: number }
export type StravaActivity = {
  id: number
  athlete?: { id: number }
  sport_type?: string
  best_efforts?: { distance: number; elapsed_time: number; start_date_local: string }[]
}

// The activity's efforts at the tracked distances, only if it's one of the athlete's runs.
// Elapsed time, like Strava's own PRs; the date only, never the time of day.
export function trackedEfforts(activity: StravaActivity, athleteId: number): Effort[] {
  if (activity.athlete?.id !== athleteId || !RUNS.has(activity.sport_type ?? '')) return []
  return EFFORTS.flatMap(({ name, metres }) => {
    const effort = activity.best_efforts?.find((e) => Math.abs(e.distance - metres) < 50)
    if (!effort || !Number.isSafeInteger(effort.elapsed_time) || effort.elapsed_time <= 0) return []
    return [{ name, seconds: effort.elapsed_time, date: String(effort.start_date_local).slice(0, 10), activityId: activity.id }]
  })
}

export type StravaEvent = {
  object_type: 'activity' | 'athlete'
  object_id: number
  aspect_type: 'create' | 'update' | 'delete'
  owner_id: number
  subscription_id: number
  event_time: number
  updates?: Record<string, unknown>
}

// Strava doesn't sign webhook events, so this only decides whether an event is worth acting on.
// Acting on it always means re-reading the activity from Strava with our own token.
export function checkEvent(body: unknown, athleteId: number, subscriptionId: number): StravaEvent | undefined {
  if (!body || typeof body !== 'object') return
  const e = body as StravaEvent
  if (![e.object_id, e.owner_id, e.subscription_id, e.event_time].every((n) => Number.isSafeInteger(n) && n > 0)) return
  if (e.owner_id !== athleteId || e.subscription_id !== subscriptionId) return
  if (e.object_type === 'activity' && ['create', 'update', 'delete'].includes(e.aspect_type)) return e
  if (e.object_type === 'athlete' && e.aspect_type === 'update') return e
}

// Compares SHA-256 digests byte by byte, so the time taken says nothing about how much of a guess was right
export async function same(a: string, b: string): Promise<boolean> {
  const digest = (s: string) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  const [x, y] = (await Promise.all([digest(a), digest(b)])).map((d) => new Uint8Array(d))
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i]
  return diff === 0
}

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0))
// STRAVA_TOKEN_KEY is 32 random bytes in base64 (`openssl rand -base64 32`), so this is AES-256-GCM
const aesKey = (secret: string) => crypto.subtle.importKey('raw', fromBase64(secret), 'AES-GCM', false, ['encrypt', 'decrypt'])

// Tokens are encrypted before they reach D1, so a database export alone gives nothing away. Stored as "iv.ciphertext".
export async function encrypt(text: string, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(secret), new TextEncoder().encode(text))
  return `${toBase64(iv)}.${toBase64(new Uint8Array(data))}`
}

export async function decrypt(box: string, secret: string): Promise<string> {
  const [iv, data] = box.split('.').map(fromBase64)
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await aesKey(secret), data))
}

// Created on first use in each isolate instead of migrations, so dev, tests and production can't drift apart
const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS strava_tokens (id INTEGER PRIMARY KEY CHECK (id = 1), box TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS strava_best_efforts (name TEXT PRIMARY KEY, seconds INTEGER NOT NULL, date TEXT NOT NULL, activity_id INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS strava_stats (id INTEGER PRIMARY KEY CHECK (id = 1), ytd TEXT NOT NULL, updated_at TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS strava_events (activity_id INTEGER NOT NULL, aspect TEXT NOT NULL, event_time INTEGER NOT NULL, status TEXT NOT NULL, PRIMARY KEY (activity_id, aspect, event_time))',
]
let ready: Promise<unknown> | undefined
const setup = (db: D1) =>
  (ready ??= db.batch(SCHEMA.map((sql) => db.prepare(sql))).catch((err) => {
    ready = undefined
    throw err
  }))

type Tokens = { access: string; refresh: string; expiresAt: number }

// A current access token, refreshed 5 minutes before it expires. Strava may hand back a new refresh token, so it's always stored.
async function accessToken(db: D1, cfg: Config): Promise<string> {
  const row = await db.prepare('SELECT box FROM strava_tokens WHERE id = 1').first<{ box: string }>()
  const stored: Tokens | undefined = row ? JSON.parse(await decrypt(row.box, cfg.tokenKey)) : undefined
  if (stored && stored.expiresAt - 300 > Date.now() / 1000) return stored.access

  const refresh = stored?.refresh ?? cfg.bootstrapRefresh
  if (!refresh) throw new Error('Strava is not connected (no refresh token)')
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, grant_type: 'refresh_token', refresh_token: refresh }),
  })
  if (!res.ok) throw new Error(`Strava token refresh failed: ${res.status}`)
  const data = (await res.json()) as { access_token: string; refresh_token: string; expires_at: number }
  const tokens: Tokens = { access: data.access_token, refresh: data.refresh_token, expiresAt: data.expires_at }
  await db
    .prepare('INSERT INTO strava_tokens (id, box) VALUES (1, ?) ON CONFLICT (id) DO UPDATE SET box = excluded.box')
    .bind(await encrypt(JSON.stringify(tokens), cfg.tokenKey))
    .run()
  return tokens.access
}

// null when Strava says there's no such thing (a deleted run, or one made private). Errors only ever carry the status code.
async function api<T>(path: string, token: string): Promise<T | null> {
  const res = await fetch(`https://www.strava.com/api/v3${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Strava ${path.split('/')[1]} request failed: ${res.status}`)
  return res.json() as Promise<T>
}

// Saves any effort that beats the stored one. One statement per distance, so two events at once can't put back a slower time.
async function syncActivity(db: D1, cfg: Config, token: string, activityId: number): Promise<void> {
  const activity = await api<StravaActivity>(`/activities/${activityId}`, token)
  const efforts = activity ? trackedEfforts(activity, cfg.athleteId) : []
  if (!efforts.length) return
  await db.batch(
    efforts.map((e) =>
      db
        .prepare(
          `INSERT INTO strava_best_efforts (name, seconds, date, activity_id) VALUES (?, ?, ?, ?)
           ON CONFLICT (name) DO UPDATE SET seconds = excluded.seconds, date = excluded.date, activity_id = excluded.activity_id
           WHERE excluded.seconds < strava_best_efforts.seconds`,
        )
        .bind(e.name, e.seconds, e.date, e.activityId),
    ),
  )
}

// Keeps only the year-to-date run totals. Strava only counts activities visible to Everyone here.
async function syncStats(db: D1, cfg: Config, token: string): Promise<void> {
  const stats = await api<{ ytd_run_totals: { count: number; distance: number; moving_time: number } }>(`/athletes/${cfg.athleteId}/stats`, token)
  if (!stats) return
  const t = stats.ytd_run_totals
  const ytd = { runs: Number(t.count) || 0, metres: Number(t.distance) || 0, seconds: Number(t.moving_time) || 0 }
  await db
    .prepare('INSERT INTO strava_stats (id, ytd, updated_at) VALUES (1, ?, ?) ON CONFLICT (id) DO UPDATE SET ytd = excluded.ytd, updated_at = excluded.updated_at')
    .bind(JSON.stringify(ytd), new Date().toISOString())
    .run()
}

// Runs after the webhook has already answered Strava. Failures are marked so the daily cron retries them.
async function processEvent(db: D1, cfg: Config, e: { activityId: number; aspect: string; eventTime: number }): Promise<void> {
  const mark = (status: string) =>
    db.prepare('UPDATE strava_events SET status = ? WHERE activity_id = ? AND aspect = ? AND event_time = ?').bind(status, e.activityId, e.aspect, e.eventTime).run()
  try {
    const token = await accessToken(db, cfg)
    // Deleting a PB run doesn't bring back the previous PB (we don't keep history); STRAVA.md lists this
    if (e.aspect !== 'delete') await syncActivity(db, cfg, token, e.activityId)
    await syncStats(db, cfg, token)
    await mark('done')
  } catch (err) {
    console.error('Strava event failed', e.activityId, e.aspect, (err as Error).message)
    await mark('failed')
  }
}

async function handleEvent(db: D1, cfg: Config, event: StravaEvent): Promise<void> {
  await setup(db)
  if (event.object_type === 'athlete') {
    // Access revoked in Strava's settings: forget the tokens straight away
    if (event.updates?.authorized === 'false') await db.prepare('DELETE FROM strava_tokens').run()
    return
  }
  // Strava retries events it thinks we missed; the primary key makes each one count once
  const { meta } = await db
    .prepare('INSERT OR IGNORE INTO strava_events (activity_id, aspect, event_time, status) VALUES (?, ?, ?, ?)')
    .bind(event.object_id, event.aspect_type, event.event_time, 'pending')
    .run()
  if (meta.changes) await processEvent(db, cfg, { activityId: event.object_id, aspect: event.aspect_type, eventTime: event.event_time })
}

// What the About page shows: whitelisted fields only, no GPS, maps or times of day
async function publicData(db: D1) {
  await setup(db)
  const { results } = await db.prepare('SELECT name, seconds, date, activity_id FROM strava_best_efforts').all<{ name: string; seconds: number; date: string; activity_id: number }>()
  const stats = await db.prepare('SELECT ytd, updated_at FROM strava_stats WHERE id = 1').first<{ ytd: string; updated_at: string }>()
  const bestEfforts = EFFORTS.flatMap(({ name }) => {
    const row = results.find((r) => r.name === name)
    return row ? [{ name, seconds: row.seconds, date: row.date, activityId: row.activity_id }] : []
  })
  return { bestEfforts, ytd: stats ? JSON.parse(stats.ytd) : null, updatedAt: stats?.updated_at ?? null }
}

const json = (body: object, status = 200, headers: HeadersInit = {}) => Response.json(body, { status, headers })
const notFound = () => json({ error: 'Not found' }, 404)
// Cloudflare's edge cache for this data centre (Workers only), so page views hardly ever touch D1
const edge = () => (caches as unknown as { default: Cache }).default
// One entry for jodev.co.za and www.jodev.co.za, so one purge clears both
const cacheKey = (url: URL) => new Request(`${url.origin.replace('://www.', '://')}/api/strava`)

// Everything under /api/strava
export async function strava(request: Request, env: StravaEnv, ctx: Ctx): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname.replace(/\/+$/, '')

  if (path === '/api/strava') {
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
    const key = cacheKey(url)
    const hit = await edge().match(key)
    if (hit) return hit
    const res = json(await publicData(env.DB), 200, { 'Cache-Control': 'public, max-age=300' })
    ctx.waitUntil(edge().put(key, res.clone()))
    return res
  }

  // The webhook URL carries the secret, so a wrong guess looks exactly like a missing page
  const hook = path.match(/^\/api\/strava\/webhook\/([^/]+)$/)
  if (hook) {
    const secret = env.STRAVA_WEBHOOK_SECRET
    if (!secret || !(await same(hook[1], secret))) return notFound()

    // Strava checks the callback when the subscription is created: echo the challenge if the verify token is ours
    if (request.method === 'GET') {
      const ok = url.searchParams.get('hub.mode') === 'subscribe' && (await same(url.searchParams.get('hub.verify_token') ?? '', secret))
      return ok ? json({ 'hub.challenge': url.searchParams.get('hub.challenge') ?? '' }) : json({ error: 'Forbidden' }, 403)
    }
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

    const cfg = config(env)
    const subscriptionId = Number(env.STRAVA_SUBSCRIPTION_ID)
    if (!cfg || !subscriptionId) return notFound()
    if (!(await env.STRAVA_LIMIT.limit({ key: 'webhook' })).success) return json({ error: 'Too many requests' }, 429)
    const text = await request.text()
    if (text.length > 2000) return json({ error: 'Too large' }, 413)
    let body: unknown
    try {
      body = JSON.parse(text)
    } catch {
      return json({ error: 'Bad request' }, 400)
    }
    const event = checkEvent(body, cfg.athleteId, subscriptionId)
    // Strava wants a 200 within 2 seconds, so the work carries on after the response. Ignored events get the same 200.
    // The purge only reaches the data centre Strava's request landed in; elsewhere the old copy lasts up to 5 minutes.
    if (event) ctx.waitUntil(handleEvent(env.DB, cfg, event).then(() => edge().delete(cacheKey(url))))
    return json({ ok: true })
  }

  // Seeding and manual re-syncs. It only accepts activity IDs to fetch from Strava, never times or other data.
  if (path === '/api/strava/admin/sync') {
    const cfg = config(env)
    if (!cfg || !env.ADMIN_TOKEN) return notFound()
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
    const ip = request.headers.get('cf-connecting-ip') ?? ''
    if (!(await env.STRAVA_LIMIT.limit({ key: `admin:${ip}` })).success) return json({ error: 'Too many requests' }, 429)
    if (!(await same(request.headers.get('authorization') ?? '', `Bearer ${env.ADMIN_TOKEN}`))) return json({ error: 'Unauthorized' }, 401)

    const body = (await request.json().catch(() => null)) as { activityIds?: unknown; stats?: unknown } | null
    const ids = body?.activityIds ?? []
    if (!Array.isArray(ids) || ids.length > 10 || !ids.every((id) => typeof id === 'number' && Number.isSafeInteger(id) && id > 0)) {
      return json({ error: 'activityIds must be up to 10 Strava activity IDs' }, 400)
    }
    try {
      await setup(env.DB)
      const token = await accessToken(env.DB, cfg)
      for (const id of ids as number[]) await syncActivity(env.DB, cfg, token, id)
      if (body?.stats === true) await syncStats(env.DB, cfg, token)
    } catch (err) {
      console.error('Strava sync failed', (err as Error).message)
      return json({ error: (err as Error).message }, 502)
    }
    // So the new numbers show straight away (in this data centre, which serves the visitors near you)
    await edge().delete(cacheKey(url))
    return json(await publicData(env.DB))
  }

  return notFound()
}

// Daily cron: refresh the stats (the year to date resets on 1 January even without new runs),
// retry events that failed, and forget events older than 30 days
export async function stravaDaily(env: StravaEnv): Promise<void> {
  const cfg = config(env)
  if (!cfg) return
  await setup(env.DB)
  const { results } = await env.DB
    .prepare("SELECT activity_id, aspect, event_time FROM strava_events WHERE status = 'failed' LIMIT 20")
    .all<{ activity_id: number; aspect: string; event_time: number }>()
  for (const r of results) await processEvent(env.DB, cfg, { activityId: r.activity_id, aspect: r.aspect, eventTime: r.event_time })
  try {
    const token = await accessToken(env.DB, cfg)
    await syncStats(env.DB, cfg, token)
  } catch (err) {
    console.error('Strava daily stats failed', (err as Error).message)
  }
  await env.DB.prepare('DELETE FROM strava_events WHERE event_time < ?').bind(Math.floor(Date.now() / 1000) - 30 * 86400).run()
}
