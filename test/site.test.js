// Runs the real Worker and built assets locally (`npm test`), or checks the live site when SITE_URL is set
// (the Deploy workflow checks green's Version URL before the switch and the live site after)
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { createTestHarness } from 'wrangler'
import { liveFetch } from '../scripts/net.ts'

const live = process.env.SITE_URL
// A workers.dev Version URL (blue-green's green) has no www and no plain http, and sits behind Cloudflare Access
const domain = live && !new URL(live).hostname.endsWith('.workers.dev')
// Access service token for green (repo secrets in the blue-green workflow)
const access = process.env.CF_ACCESS_CLIENT_ID
  ? { 'CF-Access-Client-Id': process.env.CF_ACCESS_CLIENT_ID, 'CF-Access-Client-Secret': process.env.CF_ACCESS_CLIENT_SECRET ?? '' }
  : {}
const server = live ? undefined : createTestHarness({ workers: [{ configPath: './wrangler.jsonc' }] })
// Which request each answer came from, for the failure messages
const asked = new WeakMap()
// Against a real site, a network failure gets another try (scripts/net.ts); a wrong answer never does
async function fetchLive(url, init = {}) {
  const res = await liveFetch(url, init)
  asked.set(res, `${init.method ?? 'GET'} ${url}`)
  return res
}
async function get(path, init = {}) {
  if (!server) return fetchLive(new URL(path, live), { ...init, headers: { ...init.headers, ...access } })
  const res = await server.fetch(path, init)
  asked.set(res, `${init.method ?? 'GET'} ${path}`)
  return res
}
before(() => server?.listen())
after(() => server?.close())

// A wrong status says which request, what came back, Cloudflare's ray ID (to find it in the Worker's logs) and the
// start of the body, so a red run explains itself
async function expectStatus(res, expected) {
  const allowed = [expected].flat()
  if (allowed.includes(res.status)) return
  const ray = res.headers.get('cf-ray')
  const body = (await res.clone().text()).replace(/\s+/g, ' ').trim()
  assert.fail(
    `${asked.get(res)} answered ${res.status}, expected ${allowed.join(' or ')}${ray ? ` (cf-ray ${ray})` : ''}. ` +
      `Body: ${body ? body.slice(0, 300) + (body.length > 300 ? '...' : '') : '(empty)'}`,
  )
}

function expectHeader(res, name, pattern) {
  const value = res.headers.get(name)
  assert.ok(
    value !== null && pattern.test(value),
    `${asked.get(res)}: ${name} is ${value === null ? 'missing' : JSON.stringify(value)}, expected ${pattern}`,
  )
}

async function json(res) {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    assert.fail(`${asked.get(res)}: the body isn't JSON: ${text.slice(0, 200) || '(empty)'}`)
  }
}

const BROWSER = { headers: { 'user-agent': 'Mozilla/5.0' } }
const CURL = { headers: { 'user-agent': 'curl/8.7.1' } }

const PAGES = ['/', '/cv', '/work', '/about', '/contact', '/status']

for (const path of PAGES) {
  test(`${path} serves its page with the security headers`, async () => {
    const res = await get(path, BROWSER)
    await expectStatus(res, 200)
    expectHeader(res, 'content-type', /^text\/html/)
    expectHeader(res, 'content-security-policy', /default-src 'self'/)
  })
}

test('pages point to the speculation rules, served with their own type', async () => {
  const page = await get('/about', BROWSER)
  expectHeader(page, 'speculation-rules', /^"\/speculationrules\.json"$/)
  const res = await get('/speculationrules.json')
  await expectStatus(res, 200)
  expectHeader(res, 'content-type', /^application\/speculationrules\+json/)
  const { prerender } = await json(res)
  assert.ok(JSON.stringify(prerender).includes('/contact'), '/contact is excluded')
})

// Every page's canonical URL is in the sitemap, so a new page can't be left out of it
test('the sitemap lists every page and robots.txt points to it', async () => {
  const res = await get('/sitemap.xml')
  await expectStatus(res, 200)
  expectHeader(res, 'content-type', /xml/)
  const sitemap = await res.text()
  for (const path of PAGES) {
    const html = await (await get(path, BROWSER)).text()
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1]
    assert.ok(canonical && sitemap.includes(`<loc>${canonical}</loc>`), `${path} (${canonical}) is in the sitemap`)
  }
  assert.match(await (await get('/robots.txt')).text(), /^Sitemap: https:\/\/jodev\.co\.za\/sitemap\.xml$/m)
})

test('curl on / gets the terminal card', async () => {
  const res = await get('/', CURL)
  await expectStatus(res, 200)
  expectHeader(res, 'content-type', /^text\/plain/)
  expectHeader(res, 'vary', /user-agent/i)
  const card = await res.text()
  assert.match(card, /\x1b\[38;2;\d+;\d+;\d+m[▀▄]/, 'the card has no logo pixels (ANSI truecolour ▀/▄)')
  assert.match(card, /Joseph Mitchell/)
})

test('unknown paths get the 404 page', async () => {
  const res = await get('/no-such-page', BROWSER)
  await expectStatus(res, 404)
  assert.match(await res.text(), /<!doctype html>/i)
})

test('/api/contact only accepts POST', async () => {
  await expectStatus(await get('/api/contact'), 405)
})

// Fails validation before the Turnstile check, so nothing is ever emailed (safe to run against the live site)
test('/api/contact rejects a message without a name', async () => {
  // URL-encoded, not FormData: the harness's fetch can't serialize Node's FormData, and formData() reads both
  const body = new URLSearchParams({ email: 'test@example.com', message: 'Hello' })
  const res = await get('/api/contact', { method: 'POST', body })
  await expectStatus(res, 400)
  assert.match((await json(res)).error ?? '', /name/)
})

test('/api/strava serves the public Strava data', async () => {
  const res = await get('/api/strava')
  await expectStatus(res, 200)
  const data = await json(res)
  assert.ok(Array.isArray(data.bestEfforts))
  assert.ok('ytd' in data)
  assert.ok('latestRun' in data)
})

test('/api/status serves deploys and uptime', async () => {
  const res = await get('/api/status')
  await expectStatus(res, 200)
  const data = await json(res)
  assert.ok(Array.isArray(data.deploys))
  assert.ok(Array.isArray(data.checks))
  for (const window of ['day', 'week', 'month']) assert.equal(typeof data.uptime[window]?.total, 'number')
  // Read-only: GitHub Actions writes through wrangler, never through the Worker
  await expectStatus(await get('/api/status', { method: 'POST', body: '{}' }), 405)
})

// Unset secrets (CI, the local harness) answer 404, the live site 401: either way nothing gets through
test('Strava webhook and admin sync refuse strangers', async () => {
  await expectStatus(await get('/api/strava/webhook/not-the-secret', { method: 'POST', body: '{}' }), 404)
  await expectStatus(await get('/api/strava/webhook/not-the-secret?hub.mode=subscribe&hub.challenge=x'), 404)
  await expectStatus(await get('/api/strava/admin/sync', { method: 'POST', body: '{"activityIds":[1]}' }), [401, 404])
})

// curl defaults to http and doesn't follow redirects, so an http -> https redirect for everyone breaks the card
test('plain http curl gets the card, not a redirect', { skip: !domain }, async () => {
  const res = await fetchLive(new URL('/', live.replace(/^https:/, 'http:')), { ...CURL, redirect: 'manual' })
  await expectStatus(res, 200)
  expectHeader(res, 'content-type', /^text\/plain/)
})

test('www serves the site too', { skip: !domain }, async () => {
  const url = new URL('/', live)
  url.hostname = `www.${url.hostname}`
  await expectStatus(await fetchLive(url, BROWSER), 200)
})

// Old versions keep their Version URLs (with the production secrets and database), so they must never be public.
// Without the service token, Access answers instead of the Worker: a login redirect or a refusal.
test('Version URLs are behind Cloudflare Access', { skip: !live || domain }, async () => {
  const res = await fetchLive(new URL('/', live), { ...BROWSER, redirect: 'manual' })
  await expectStatus(res, [302, 401, 403])
})
