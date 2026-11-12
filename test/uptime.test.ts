// The Worker's uptime trigger: the exact request it sends GitHub, and that a missing token or a failed call
// only logs instead of throwing (a throw would fail the cron run for nothing).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { triggerUptime } from '../uptime.ts'

function fakeFetch(status: number) {
  const calls: { url: string; init: RequestInit }[] = []
  const fetcher = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return new Response(status === 204 ? null : 'Bad credentials', { status })
  }) as unknown as typeof fetch
  return { calls, fetcher }
}

test('the trigger dispatches the Uptime workflow on main', async () => {
  const { calls, fetcher } = fakeFetch(204)
  await triggerUptime({ GITHUB_DISPATCH_TOKEN: 'token' }, fetcher)
  assert.equal(calls.length, 1)
  const { url, init } = calls[0]
  assert.equal(url, 'https://api.github.com/repos/Joseph-M-2005/jodev.co.za/actions/workflows/uptime.yml/dispatches')
  assert.equal(init.method, 'POST')
  const headers = init.headers as Record<string, string>
  assert.equal(headers.Authorization, 'Bearer token')
  assert.ok(headers['User-Agent'])
  assert.deepEqual(JSON.parse(init.body as string), { ref: 'main' })
})

test('no token or a failed dispatch logs instead of throwing', async (t) => {
  const errors = t.mock.method(console, 'error', () => {})
  const { calls, fetcher } = fakeFetch(401)
  await triggerUptime({}, fetcher)
  assert.equal(calls.length, 0)
  await triggerUptime({ GITHUB_DISPATCH_TOKEN: 'token' }, fetcher)
  assert.equal(calls.length, 1)
  assert.equal(errors.mock.callCount(), 2)
})
