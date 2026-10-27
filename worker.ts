import { WorkerMailer } from 'worker-mailer'
import { strava, stravaDaily, type Ctx, type StravaEnv } from './strava'

interface Env extends StravaEnv {
  ASSETS: { fetch: typeof fetch }
  CONTACT_LIMIT: { limit(options: { key: string }): Promise<{ success: boolean }> }
  SMTP_PASSWORD: string
  TURNSTILE_SECRET: string
}

const ME = 'joseph@jodev.co.za'
// Zoho lists the right host under Settings > Mail Accounts: smtp.zoho.com (free plan), smtppro.zoho.com (paid)
const SMTP_HOST = 'smtp.zoho.com'
// No whitespace or address separators, so the Reply-To header can only ever hold one address
const EMAIL = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/
const PHONE = /^\+?[\d\s()-]{7,20}$/

const json = (body: object, status = 200) => Response.json(body, { status })
const bad = (error: string) => json({ error }, 400)

// `curl jodev.co.za` gets a text card instead of the homepage HTML
const TERMINAL = /^(curl|wget|httpie)\//i
const RESET = '\x1b[0m'
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(';')
const fg = (hex: string) => `\x1b[38;2;${rgb(hex)}m`
const bg = (hex: string) => `\x1b[48;2;${rgb(hex)}m`
// Built once per isolate from the logo, so it can't drift from favicon.svg
let card: string | undefined

function renderCard(svg: string): string {
  // The logo is a grid of 16px cells drawn as one-row runs, so each rect fills `width / 16` cells
  const grid: string[][] = []
  for (const [, x, y, width, fill] of svg.matchAll(/<rect x="(\d+)" y="(\d+)" width="(\d+)" height="16" fill="(#[0-9a-f]{6})"/g)) {
    const row = (grid[+y / 16] ??= [])
    for (let i = 0; i < +width / 16; i++) row[+x / 16 + i] = fill
  }
  // Cropped to the drawn cells; Object.keys and flatMap skip the empty slots
  const ys = Object.keys(grid).map(Number)
  const xs = grid.flatMap((row) => Object.keys(row).map(Number))
  const lines: string[] = []
  // Two pixel rows per line: the half block's foreground is the top pixel, its background the bottom one
  for (let y = Math.min(...ys); y <= Math.max(...ys); y += 2) {
    let line = '  '
    for (let x = Math.min(...xs); x <= Math.max(...xs); x++) {
      const top = grid[y]?.[x]
      const bottom = grid[y + 1]?.[x]
      line += top ? fg(top) + (bottom ? bg(bottom) : '') + '▀' + RESET : bottom ? fg(bottom) + '▄' + RESET : ' '
    }
    lines.push(line.trimEnd())
  }
  const row = (label: string, value: string) => `  ${fg('#12a2e5')}${label.padEnd(10)}${fg('#8fa3e8')}${value}${RESET}`
  return [
    '',
    ...lines,
    '',
    `  \x1b[1m${fg('#12a2e5')}Joseph Mitchell${RESET}`,
    `  ${fg('#8fa3e8')}Frontend developer, Gqeberha, South Africa${RESET}`,
    '',
    row('web', 'https://jodev.co.za'),
    row('email', ME),
    row('github', 'https://github.com/Joseph-M-2005'),
    row('linkedin', 'https://www.linkedin.com/in/joseph-mitchell-2005-profile/'),
    '',
    `  ${fg('#8fa3e8')}Open https://jodev.co.za in a browser for the full site.${RESET}`,
    '',
    '',
  ].join('\n')
}

export default {
  async fetch(request: Request, env: Env, ctx: Ctx): Promise<Response> {
    const { pathname } = new URL(request.url)
    if (pathname === '/' && TERMINAL.test(request.headers.get('user-agent') ?? '')) {
      card ??= renderCard(await env.ASSETS.fetch(new URL('/favicon.svg', request.url)).then((res) => res.text()))
      // no-store and Vary so no cache ever hands the card to a browser or the HTML to curl
      return new Response(card, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', Vary: 'User-Agent' } })
    }
    if (pathname === '/api/strava' || pathname.startsWith('/api/strava/')) return strava(request, env, ctx)
    if (pathname !== '/api/contact') return env.ASSETS.fetch(request)
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

    // Caps inbox floods and keeps us under Zoho's hourly SMTP limit
    const ip = request.headers.get('cf-connecting-ip') ?? ''
    const { success } = await env.CONTACT_LIMIT.limit({ key: ip })
    if (!success) return json({ error: 'Too many messages, try again in a minute.' }, 429)

    const form = await request.formData().catch(() => null)
    if (!form) return bad('Bad request')
    const field = (key: string) => String(form.get(key) ?? '').trim()

    // Bots fill every field; people never see this one
    if (field('website')) return json({ ok: true })

    // The name goes in the Subject header, which worker-mailer passes through as-is when it's ASCII
    const name = field('name').replace(/[\r\n]+/g, ' ')
    const email = field('email')
    const phone = field('phone')
    const message = field('message')

    if (!name || name.length > 100) return bad('Please add your name (up to 100 characters).')
    if (email && (email.length > 254 || !EMAIL.test(email))) return bad("That email address doesn't look right.")
    if (phone && !PHONE.test(phone)) return bad("That phone number doesn't look right.")
    if (!email && !phone) return bad('Add an email or phone number so I can reply.')
    if (!message || message.length > 5000) return bad('Please add a message (up to 5000 characters).')

    // Checked after the fields because a Turnstile token can only be verified once
    const human = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: field('cf-turnstile-response'), remoteip: ip }),
    })
      .then((res) => res.json() as Promise<{ success: boolean }>)
      .then((result) => result.success)
      .catch(() => false)
    if (!human) return bad(`The "are you human" check didn't pass. Try again, or email ${ME} directly.`)

    // SMTP wants CRLF line endings; worker-mailer only dot-stuffs after \r\n
    const text = `Name: ${name}\nEmail: ${email || '-'}\nPhone: ${phone || '-'}\n\n${message}`.replace(/\r?\n/g, '\r\n')

    try {
      await WorkerMailer.send(
        // authType must be set: worker-mailer defaults to an empty list and then refuses to log in
        { host: SMTP_HOST, port: 465, secure: true, credentials: { username: ME, password: env.SMTP_PASSWORD }, authType: ['plain', 'login'] },
        { from: { name: 'jodev contact form', email: ME }, to: ME, reply: email || undefined, subject: `Contact form: ${name}`, text },
      )
    } catch (err) {
      console.error('Contact form send failed', err)
      return json({ error: `Couldn't send right now. Email ${ME} directly.` }, 502)
    }
    return json({ ok: true })
  },

  // Daily cron (wrangler.jsonc triggers)
  async scheduled(_controller: unknown, env: Env, ctx: Ctx): Promise<void> {
    ctx.waitUntil(stravaDaily(env))
  },
}
