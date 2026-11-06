// The contact form's pure logic: field checks, the email it builds, and the queue consumer's ack/retry.
// Node runs the TypeScript directly; SMTP and D1 are faked.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkFields, deadLetters, retryDelay, sendBatch, toMail, type ContactMessage, type QueueMessage } from '../contact.ts'

const form = (values: Record<string, string>) => (key: string) => values[key] ?? ''
const good = { name: 'Sam', email: 'sam@example.com', message: 'Hello' }
const NOW = new Date('2026-11-06T10:00:00Z')

test('a filled-in form becomes a message with the time it was sent', () => {
  assert.deepEqual(checkFields(form(good), NOW), { ...good, phone: '', sentAt: '2026-11-06T10:00:00.000Z' })
  assert.ok(!('error' in checkFields(form({ name: 'Sam', phone: '+27 82 123 4567', message: 'Hi' }))))
})

test('bad fields are refused with a message for the visitor', () => {
  for (const [values, error] of [
    [{ ...good, name: '' }, /name/],
    [{ ...good, name: 'x'.repeat(101) }, /name/],
    [{ ...good, email: 'not an email' }, /email/],
    [{ ...good, email: 'a@b.com, c@d.com' }, /email/],
    [{ ...good, email: '', phone: 'call me' }, /phone/],
    [{ ...good, email: '' }, /email or phone/],
    [{ ...good, message: '' }, /message/],
    [{ ...good, message: 'x'.repeat(5001) }, /message/],
  ] as const) {
    const result = checkFields(form(values))
    assert.ok('error' in result, JSON.stringify(values))
    assert.match(result.error, error)
  }
})

test('newlines in the name cannot add email headers', () => {
  const result = checkFields(form({ ...good, name: 'Sam\r\nBcc: x@y.com' }))
  assert.ok(!('error' in result))
  assert.equal(toMail(result).subject, 'Contact form: Sam Bcc: x@y.com')
})

test('the email uses CRLF line endings and replies to the visitor', () => {
  const msg: ContactMessage = { ...good, phone: '', message: 'line one\nline two', sentAt: '2026-11-06T10:00:00.000Z' }
  const mail = toMail(msg)
  assert.equal(mail.reply, 'sam@example.com')
  assert.equal(mail.text, 'Name: Sam\r\nEmail: sam@example.com\r\nPhone: -\r\nSent: 2026-11-06T10:00:00.000Z\r\n\r\nline one\r\nline two')
  assert.equal(toMail({ ...msg, email: '' }).reply, undefined)
})

// A queue message that records what the consumer did with it
function fake(body: ContactMessage, attempts = 1) {
  const seen: { acked: boolean; retried?: number } = { acked: false }
  const msg: QueueMessage<ContactMessage> = {
    body,
    attempts,
    ack: () => void (seen.acked = true),
    retry: (options) => void (seen.retried = options?.delaySeconds),
  }
  return { msg, seen }
}
const body: ContactMessage = { ...good, phone: '', sentAt: NOW.toISOString() }

test('sent emails are acked, failed ones retried with backoff', async () => {
  const ok = fake(body)
  const fails = fake({ ...body, name: 'Fails' }, 3)
  const sent: string[] = []
  await sendBatch({ queue: 'jodev-contact', messages: [ok.msg, fails.msg] }, async (mail) => {
    if (mail.subject.endsWith('Fails')) throw new Error('SMTP down')
    sent.push(mail.subject)
  })
  assert.deepEqual(sent, ['Contact form: Sam'])
  assert.deepEqual(ok.seen, { acked: true })
  assert.deepEqual(fails.seen, { acked: false, retried: 240 })
})

test('retries back off 1, 2, 4, 8, 16 minutes and never wait past 30', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(retryDelay), [60, 120, 240, 480, 960])
  assert.equal(retryDelay(10), 1800)
})

test('dead letters are saved to D1, or retried if D1 fails', async () => {
  const rows: unknown[][] = []
  const db = (fail: boolean) => ({
    prepare: (sql: string) => ({
      bind: (...values: unknown[]) => ({ run: async () => (fail ? Promise.reject(new Error('D1 down')) : (rows.push(values), { meta: { changes: 1 } })) }),
      run: async () => ({ meta: { changes: 0 } }),
      sql,
    }),
    batch: async () => [],
  })
  const saved = fake(body)
  await deadLetters({ queue: 'jodev-contact-dlq', messages: [saved.msg] }, db(false) as never, NOW)
  assert.deepEqual(saved.seen, { acked: true })
  assert.deepEqual(rows, [[body.sentAt, NOW.toISOString(), JSON.stringify(body)]])

  const lost = fake(body)
  await deadLetters({ queue: 'jodev-contact-dlq', messages: [lost.msg] }, db(true) as never, NOW)
  assert.deepEqual(lost.seen, { acked: false, retried: 300 })
})
