// The contact form. The request side checks the form and queues it; the queue consumer sends the email,
// retrying with backoff, and anything that still fails lands in D1 so no message is ever lost quietly.
// No worker-mailer import here, so the Node tests can load this file: the Worker passes the real send in.
import type { D1 } from './strava'

export const ME = 'joseph@jodev.co.za'
// No whitespace or address separators, so the Reply-To header can only ever hold one address
const EMAIL = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/
const PHONE = /^\+?[\d\s()-]{7,20}$/

// What goes on the queue: the checked fields and when they were sent
export type ContactMessage = { name: string; email: string; phone: string; message: string; sentAt: string }
export type Mail = { from: { name: string; email: string }; to: string; reply?: string; subject: string; text: string }

// Just the parts of the Queues runtime this file uses
export interface QueueMessage<T> {
  body: T
  attempts: number
  ack(): void
  retry(options?: { delaySeconds?: number }): void
}
export interface QueueBatch<T> {
  queue: string
  messages: readonly QueueMessage<T>[]
}
export interface ContactEnv {
  CONTACT_LIMIT: { limit(options: { key: string }): Promise<{ success: boolean }> }
  CONTACT_QUEUE: { send(body: ContactMessage): Promise<void> }
  TURNSTILE_SECRET: string
  DB: D1
}

const json = (body: object, status = 200) => Response.json(body, { status })
const bad = (error: string) => json({ error }, 400)

// The form's fields, checked: the message to queue, or the error to show
export function checkFields(field: (key: string) => string, now = new Date()): ContactMessage | { error: string } {
  // The name goes in the Subject header, which worker-mailer passes through as-is when it's ASCII
  const name = field('name').replace(/[\r\n]+/g, ' ')
  const email = field('email')
  const phone = field('phone')
  const message = field('message')

  if (!name || name.length > 100) return { error: 'Please add your name (up to 100 characters).' }
  if (email && (email.length > 254 || !EMAIL.test(email))) return { error: "That email address doesn't look right." }
  if (phone && !PHONE.test(phone)) return { error: "That phone number doesn't look right." }
  if (!email && !phone) return { error: 'Add an email or phone number so I can reply.' }
  if (!message || message.length > 5000) return { error: 'Please add a message (up to 5000 characters).' }
  return { name, email, phone, message, sentAt: now.toISOString() }
}

// The email for a queued message. SMTP wants CRLF line endings; worker-mailer only dot-stuffs after \r\n
export function toMail(msg: ContactMessage): Mail {
  const text = `Name: ${msg.name}\nEmail: ${msg.email || '-'}\nPhone: ${msg.phone || '-'}\nSent: ${msg.sentAt}\n\n${msg.message}`.replace(/\r?\n/g, '\r\n')
  return { from: { name: 'jodev contact form', email: ME }, to: ME, reply: msg.email || undefined, subject: `Contact form: ${msg.name}`, text }
}

// POST /api/contact
export async function contact(request: Request, env: ContactEnv): Promise<Response> {
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

  const checked = checkFields(field)
  if ('error' in checked) return bad(checked.error)

  // Checked after the fields because a Turnstile token can only be verified once
  const human = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: field('cf-turnstile-response'), remoteip: ip }),
  })
    .then((res) => res.json() as Promise<{ success: boolean }>)
    .then((result) => result.success)
    .catch(() => false)
  if (!human) return bad(`The "are you human" check didn't pass. Try again, or email ${ME} directly.`)

  // Once it's on the queue it's stored, so the visitor is done; the consumer deals with Zoho
  try {
    await env.CONTACT_QUEUE.send(checked)
  } catch (err) {
    console.error('Contact form enqueue failed', err)
    return json({ error: `Couldn't send right now. Email ${ME} directly.` }, 502)
  }
  return json({ ok: true })
}

// Wait before the next try: 1, 2, 4, 8, 16 minutes (attempts starts at 1), capped at 30
export const retryDelay = (attempts: number) => Math.min(60 * 2 ** (attempts - 1), 1800)

// The main queue: one email per message, sent one at a time. A failed send goes back on the queue for later;
// after max_retries (wrangler.jsonc) Cloudflare moves it to the dead-letter queue.
export async function sendBatch(batch: QueueBatch<ContactMessage>, send: (mail: Mail) => Promise<void>): Promise<void> {
  for (const msg of batch.messages) {
    try {
      await send(toMail(msg.body))
      msg.ack()
    } catch (err) {
      console.error(`Contact email failed (attempt ${msg.attempts}), retrying`, err)
      msg.retry({ delaySeconds: retryDelay(msg.attempts) })
    }
  }
}

// Created on first use in each isolate, like the Strava tables
const SCHEMA = 'CREATE TABLE IF NOT EXISTS contact_failed (sent_at TEXT NOT NULL, failed_at TEXT NOT NULL, body TEXT NOT NULL)'
let ready: Promise<unknown> | undefined
const setup = (db: D1) =>
  (ready ??= db.prepare(SCHEMA).run().catch((err) => {
    ready = undefined
    throw err
  }))

// The dead-letter queue: messages Zoho never took. Kept in D1 to send by hand
// (`wrangler d1 execute jodev --remote --command "SELECT * FROM contact_failed"`).
export async function deadLetters(batch: QueueBatch<ContactMessage>, db: D1, now = new Date()): Promise<void> {
  for (const msg of batch.messages) {
    try {
      await setup(db)
      await db.prepare('INSERT INTO contact_failed (sent_at, failed_at, body) VALUES (?, ?, ?)').bind(msg.body.sentAt, now.toISOString(), JSON.stringify(msg.body)).run()
      console.error(`Contact email gave up after every retry, saved to contact_failed (sent ${msg.body.sentAt})`)
      msg.ack()
    } catch (err) {
      // Last resort: the logs keep the whole message, so it can still be found there
      console.error('Contact email gave up and could not be saved', JSON.stringify(msg.body), err)
      msg.retry({ delaySeconds: 300 })
    }
  }
}
