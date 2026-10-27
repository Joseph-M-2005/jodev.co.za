// One-time Strava setup, run on your own machine (STRAVA.md, "Setup").
//   node scripts/strava.mjs auth          connect your Strava account; stores the refresh token and athlete id as Worker secrets
//   node scripts/strava.mjs auth --local  the same, but saved to .dev.vars for `npm run preview`
//   node scripts/strava.mjs subscribe     create the webhook subscription for the live site; stores its id as a secret
// Reads STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET and STRAVA_WEBHOOK_SECRET from the environment or .dev.vars,
// so no secret is ever typed on the command line (or kept in shell history).
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'

const SITE = 'https://jodev.co.za'
// 127.0.0.1 rather than localhost, which can resolve to IPv6 first; Strava always allows both for redirects
const REDIRECT = 'http://127.0.0.1:8723/callback'

const devVars = existsSync('.dev.vars')
  ? Object.fromEntries([...readFileSync('.dev.vars', 'utf8').matchAll(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/gm)].map((m) => [m[1], m[2]]))
  : {}
const env = { ...devVars, ...process.env }

function need(name) {
  if (!env[name]) throw new Error(`Missing ${name}: add it to .dev.vars or the environment`)
  return env[name]
}

// Checked before anything is created on Strava's side, so a missing login can't waste an approval or a subscription
async function checkWranglerLogin() {
  const out = await new Promise((resolve) => {
    // One command string with shell: true (npx needs a shell on Windows; Node warns about args + shell)
    const child = spawn('npx wrangler whoami', { shell: true })
    let text = ''
    child.stdout.on('data', (d) => (text += d))
    child.stderr.on('data', (d) => (text += d))
    child.on('exit', () => resolve(text))
  })
  if (!/You are logged in/i.test(out)) throw new Error('Wrangler is not logged in. Run `npx wrangler login` first, then run this again.')
}

// Pipes the value into `wrangler secret put`, so it never appears on screen
function secretPut(name, value) {
  return new Promise((resolve, reject) => {
    // `name` is always one of this file's fixed secret names, never input
    const child = spawn(`npx wrangler secret put ${name}`, { stdio: ['pipe', 'inherit', 'inherit'], shell: true })
    child.stdin.end(value)
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`wrangler secret put ${name} failed`))))
  })
}

async function auth(local) {
  const clientId = need('STRAVA_CLIENT_ID')
  const clientSecret = need('STRAVA_CLIENT_SECRET')
  if (!local) await checkWranglerLogin()
  // Random state ties the callback to this run, so nobody else's authorisation can be slipped in
  const state = randomBytes(16).toString('hex')
  const query = new URLSearchParams({ client_id: clientId, redirect_uri: REDIRECT, response_type: 'code', approval_prompt: 'force', scope: 'read,activity:read', state })
  console.log(`Open this link, sign in to Strava and approve:\n\n  https://www.strava.com/oauth/authorize?${query}\n`)

  const code = await new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, REDIRECT)
      if (url.pathname !== '/callback') return res.writeHead(404).end()
      const q = url.searchParams
      const ok = q.get('state') === state && q.get('code') && (q.get('scope') ?? '').split(',').includes('activity:read')
      res.writeHead(ok ? 200 : 400, { 'Content-Type': 'text/plain' })
      res.end(ok ? 'Connected. You can close this tab.' : 'That did not work: tick "View data about your activities" and try again.')
      server.close()
      ok ? resolve(q.get('code')) : reject(new Error('Authorisation failed (state mismatch or activity access not granted)'))
    }).listen(8723, '127.0.0.1')
  })

  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, grant_type: 'authorization_code' }),
  })
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`)
  const { refresh_token: refreshToken, athlete } = await res.json()

  const saveLocally = () => appendFileSync('.dev.vars', `\nSTRAVA_REFRESH_TOKEN=${refreshToken}\nSTRAVA_ATHLETE_ID=${athlete.id}\n`)
  if (local) {
    saveLocally()
    console.log('Saved STRAVA_REFRESH_TOKEN and STRAVA_ATHLETE_ID to .dev.vars')
  } else {
    try {
      await secretPut('STRAVA_REFRESH_TOKEN', refreshToken)
      await secretPut('STRAVA_ATHLETE_ID', String(athlete.id))
    } catch (err) {
      // Never lose an approved token: keep it locally so it can be put into Cloudflare by hand
      saveLocally()
      throw new Error(`${err.message}. The token was saved to .dev.vars instead; put STRAVA_REFRESH_TOKEN and STRAVA_ATHLETE_ID with wrangler secret put (STRAVA.md, Setup).`)
    }
  }
  console.log(`Connected as athlete ${athlete.id}.`)
}

async function subscribe() {
  const secret = need('STRAVA_WEBHOOK_SECRET')
  await checkWranglerLogin()
  // Strava calls this URL straight away to check it, so the Worker must already be deployed with STRAVA_WEBHOOK_SECRET set
  const res = await fetch('https://www.strava.com/api/v3/push_subscriptions', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: need('STRAVA_CLIENT_ID'),
      client_secret: need('STRAVA_CLIENT_SECRET'),
      callback_url: `${SITE}/api/strava/webhook/${secret}`,
      verify_token: secret,
    }),
  })
  const data = await res.json()
  // Strava's errors can echo the callback URL, which holds the secret, so only the codes are shown
  if (!res.ok) throw new Error(`Subscription failed: ${res.status} ${(data.errors ?? []).map((e) => `${e.field} ${e.code}`).join(', ')}`)
  // Not secret, so it's shown first: if storing it fails, it can be put by hand
  console.log(`Subscribed (id ${data.id}).`)
  await secretPut('STRAVA_SUBSCRIPTION_ID', String(data.id))
}

const [command, flag] = process.argv.slice(2)
try {
  if (command === 'auth') await auth(flag === '--local')
  else if (command === 'subscribe') await subscribe()
  else console.log('Usage: node scripts/strava.mjs auth [--local] | subscribe')
} catch (err) {
  console.error(err.message)
  process.exit(1)
}
