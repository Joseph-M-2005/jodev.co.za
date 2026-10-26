// Runs the real Worker and built assets locally (`npm test`), or checks the live site when SITE_URL is set
// (the Deploy workflow does that after deploying)
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { createTestHarness } from 'wrangler'

const live = process.env.SITE_URL
const server = live ? undefined : createTestHarness({ workers: [{ configPath: './wrangler.jsonc' }] })
const get = (path, init) => (server ? server.fetch(path, init) : fetch(new URL(path, live), init))
before(() => server?.listen())
after(() => server?.close())

const BROWSER = { headers: { 'user-agent': 'Mozilla/5.0' } }
const CURL = { headers: { 'user-agent': 'curl/8.7.1' } }

for (const path of ['/', '/cv', '/work', '/about', '/contact']) {
  test(`${path} serves its page with the security headers`, async () => {
    const res = await get(path, BROWSER)
    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-type'), /^text\/html/)
    assert.match(res.headers.get('content-security-policy') ?? '', /default-src 'self'/)
  })
}

test('curl on / gets the terminal card', async () => {
  const res = await get('/', CURL)
  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-type'), /^text\/plain/)
  assert.match(res.headers.get('vary') ?? '', /user-agent/i)
  const card = await res.text()
  assert.match(card, /\x1b\[38;2;\d+;\d+;\d+m[▀▄]/, 'logo pixels')
  assert.match(card, /Joseph Mitchell/)
})

test('unknown paths get the 404 page', async () => {
  const res = await get('/no-such-page', BROWSER)
  assert.equal(res.status, 404)
  assert.match(await res.text(), /<!doctype html>/i)
})

test('/api/contact only accepts POST', async () => {
  assert.equal((await get('/api/contact')).status, 405)
})

// Fails validation before the Turnstile check, so nothing is ever emailed (safe to run against the live site)
test('/api/contact rejects a message without a name', async () => {
  // URL-encoded, not FormData: the harness's fetch can't serialize Node's FormData, and formData() reads both
  const body = new URLSearchParams({ email: 'test@example.com', message: 'Hello' })
  const res = await get('/api/contact', { method: 'POST', body })
  assert.equal(res.status, 400)
  assert.match((await res.json()).error, /name/)
})

// curl defaults to http and doesn't follow redirects, so an http -> https redirect for everyone breaks the card
test('plain http curl gets the card, not a redirect', { skip: !live }, async () => {
  const res = await fetch(new URL('/', live.replace(/^https:/, 'http:')), { ...CURL, redirect: 'manual' })
  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-type'), /^text\/plain/)
})

test('www serves the site too', { skip: !live }, async () => {
  const url = new URL('/', live)
  url.hostname = `www.${url.hostname}`
  assert.equal((await fetch(url, BROWSER)).status, 200)
})
