import { WorkerMailer } from 'worker-mailer'

interface Env {
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname !== '/api/contact') return env.ASSETS.fetch(request)
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
}
