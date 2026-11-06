// The status page's pure logic: how a Deploy run's state maps to an outcome, and the SQL the record script builds.
// The SQL has no bound parameters, so the validators are the security boundary: anything odd must throw.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkSql, deploySql, outcomeOf, type DeployRow } from '../status.ts'

test('each way a Deploy run can end gets its own outcome', () => {
  const run = { success: false, switched: true, drill: false, blueCheckFailed: false }
  assert.equal(outcomeOf({ ...run, success: true }), 'live')
  assert.equal(outcomeOf({ ...run, switched: false }), 'stopped')
  assert.equal(outcomeOf({ ...run, switched: false, drill: true }), 'stopped')
  assert.equal(outcomeOf(run), 'rolled_back')
  assert.equal(outcomeOf({ ...run, drill: true }), 'drill')
  assert.equal(outcomeOf({ ...run, drill: true, blueCheckFailed: true }), 'rollback_failed')
})

const row: DeployRow = {
  at: '2026-11-06T10:00:00.000Z',
  sha: '1e1138f'.padEnd(40, 'a'),
  green: '0f3a1c2e-1234-4abc-9def-0123456789ab',
  blue: null,
  outcome: 'live',
  runUrl: 'https://github.com/Joseph-M-2005/jodev.co.za/actions/runs/123456',
}

test('a good deploy row becomes one INSERT', () => {
  assert.equal(
    deploySql(row),
    `INSERT INTO status_deploys (at, sha, green, blue, outcome, run_url) VALUES ('${row.at}', '${row.sha}', '${row.green}', NULL, 'live', '${row.runUrl}')`,
  )
})

test('anything that is not exactly the expected shape is refused', () => {
  for (const bad of [
    { at: "2026-11-06'; DROP TABLE status_deploys; --" },
    { sha: '1e1138f' },
    { sha: "a'".padEnd(40, 'a') },
    { green: 'not-a-version' },
    { blue: "0f3a1c2e-1234-4abc-9def-0123456789a'" },
    { outcome: 'great' as never },
    { runUrl: 'https://evil.example/actions/runs/1' },
    { runUrl: 'https://github.com/Joseph-M-2005/jodev.co.za/actions/runs/1?x=1' },
  ]) {
    assert.throws(() => deploySql({ ...row, ...bad }), undefined, JSON.stringify(bad))
  }
})

test('a check is stored with pruning of rows past 90 days', () => {
  const sql = checkSql({ at: '2026-11-06T10:00:00.000Z', ok: true, ms: 182 })
  assert.match(sql, /VALUES \('2026-11-06T10:00:00.000Z', 1, 182\)/)
  assert.match(sql, /DELETE FROM status_checks WHERE at < '2026-08-08T10:00:00.000Z'/)
  assert.match(checkSql({ at: '2026-11-06T10:00:00.000Z', ok: false, ms: null }), /0, NULL\)/)
  assert.throws(() => checkSql({ at: 'yesterday', ok: true, ms: 1 }))
  assert.throws(() => checkSql({ at: '2026-11-06T10:00:00.000Z', ok: true, ms: 1.5 }))
  assert.throws(() => checkSql({ at: '2026-11-06T10:00:00.000Z', ok: true, ms: -1 }))
})
