// The Strava module's pure logic: which webhook events count, which efforts get saved, token encryption.
// Node runs the TypeScript directly.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkEvent, decrypt, encrypt, same, trackedEfforts, type StravaActivity } from '../strava.ts'

const ATHLETE = 1234
const SUBSCRIPTION = 99
const event = { object_type: 'activity', object_id: 555, aspect_type: 'create', owner_id: ATHLETE, subscription_id: SUBSCRIPTION, event_time: 1_700_000_000 }

test('webhook events are only acted on when they are ours and well formed', () => {
  assert.ok(checkEvent(event, ATHLETE, SUBSCRIPTION))
  assert.ok(checkEvent({ ...event, object_type: 'athlete', aspect_type: 'update', updates: { authorized: 'false' } }, ATHLETE, SUBSCRIPTION))
  for (const bad of [
    null,
    'nope',
    { ...event, owner_id: 1 },
    { ...event, subscription_id: 1 },
    { ...event, aspect_type: 'merge' },
    { ...event, object_type: 'segment' },
    { ...event, object_id: '555' },
    { ...event, object_id: -1 },
    { ...event, event_time: undefined },
  ]) {
    assert.equal(checkEvent(bad, ATHLETE, SUBSCRIPTION), undefined, JSON.stringify(bad))
  }
})

test("only the athlete's runs give best efforts, at the tracked distances, date only", () => {
  const run: StravaActivity = {
    id: 7,
    athlete: { id: ATHLETE },
    sport_type: 'Run',
    best_efforts: [
      { distance: 1000, elapsed_time: 200, start_date_local: '2026-05-01T06:12:00Z' },
      { distance: 5000, elapsed_time: 1200, start_date_local: '2026-05-01T06:12:00Z' },
      { distance: 21097, elapsed_time: 5900, start_date_local: '2026-05-01T06:12:00Z' },
    ],
  }
  assert.deepEqual(trackedEfforts(run, ATHLETE), [
    { name: '5K', seconds: 1200, date: '2026-05-01', activityId: 7 },
    { name: 'Half Marathon', seconds: 5900, date: '2026-05-01', activityId: 7 },
  ])
  assert.deepEqual(trackedEfforts({ ...run, athlete: { id: 1 } }, ATHLETE), [], "someone else's run")
  assert.deepEqual(trackedEfforts({ ...run, sport_type: 'Ride' }, ATHLETE), [], 'not a run')
  assert.deepEqual(trackedEfforts({ ...run, best_efforts: [{ distance: 5000, elapsed_time: 0, start_date_local: '2026-05-01' }] }, ATHLETE), [], 'no time')
})

test('tokens round-trip through AES-GCM and a different key cannot read them', async () => {
  const key = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64')
  const mine = key()
  const box = await encrypt('refresh-token-123', mine)
  assert.ok(!box.includes('refresh-token-123'))
  assert.equal(await decrypt(box, mine), 'refresh-token-123')
  await assert.rejects(decrypt(box, key()))
})

test('secret comparison only matches exactly', async () => {
  assert.equal(await same('Bearer abc', 'Bearer abc'), true)
  assert.equal(await same('Bearer abd', 'Bearer abc'), false)
  assert.equal(await same('Bearer abc ', 'Bearer abc'), false)
  assert.equal(await same('', 'Bearer abc'), false)
})
