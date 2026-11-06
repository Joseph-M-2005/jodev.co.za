import { WorkerMailer } from 'worker-mailer'
import { contact, deadLetters, ME, sendBatch, type ContactEnv, type ContactMessage, type Mail, type QueueBatch } from './contact'
import { strava, stravaDaily, type Ctx, type StravaEnv } from './strava'

interface Env extends StravaEnv, ContactEnv {
  ASSETS: { fetch: typeof fetch }
  SMTP_PASSWORD: string
}

// Zoho lists the right host under Settings > Mail Accounts: smtp.zoho.com (free plan), smtppro.zoho.com (paid)
const SMTP_HOST = 'smtp.zoho.com'
const smtp = (env: Env) => (mail: Mail) =>
  // authType must be set: worker-mailer defaults to an empty list and then refuses to log in
  WorkerMailer.send({ host: SMTP_HOST, port: 465, secure: true, credentials: { username: ME, password: env.SMTP_PASSWORD }, authType: ['plain', 'login'] }, mail)

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
    if (pathname === '/api/contact') return contact(request, env)
    return env.ASSETS.fetch(request)
  },

  // Contact form emails (contact.ts); queue names match wrangler.jsonc
  async queue(batch: QueueBatch<ContactMessage>, env: Env): Promise<void> {
    if (batch.queue === 'jodev-contact-dlq') return deadLetters(batch, env.DB)
    return sendBatch(batch, smtp(env))
  },

  // Daily cron (wrangler.jsonc triggers)
  async scheduled(_controller: unknown, env: Env, ctx: Ctx): Promise<void> {
    ctx.waitUntil(stravaDaily(env))
  },
}
