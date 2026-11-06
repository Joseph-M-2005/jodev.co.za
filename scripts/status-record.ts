// Writes a row for the /status page into the live D1 database. Run by GitHub Actions:
//   node scripts/status-record.ts deploy   (last step of Deploy; reads the run's state from env vars)
//   node scripts/status-record.ts check    (Uptime; times a GET of the home page itself)
// Add --local to write to the local database `npm run preview` uses instead.
// Needs CLOUDFLARE_API_TOKEN (with D1 Edit) and CLOUDFLARE_ACCOUNT_ID for the remote database.
import { execFileSync } from 'node:child_process'
import { STATUS_SCHEMA, checkSql, deploySql, outcomeOf } from '../status.ts'

const [kind, ...flags] = process.argv.slice(2)
const local = flags.includes('--local')
const env = (name: string) => process.env[name] ?? ''

let sql: string
if (kind === 'deploy') {
  const outcome = outcomeOf({
    success: env('JOB_STATUS') === 'success',
    switched: env('SWITCHED') === '1',
    drill: env('REHEARSE') === 'true',
    blueCheckFailed: env('BLUE_CHECK') === 'failure',
  })
  sql = deploySql({
    at: new Date().toISOString(),
    sha: env('GITHUB_SHA'),
    green: env('GREEN') || null,
    blue: env('BLUE') || null,
    outcome,
    runUrl: `${env('GITHUB_SERVER_URL')}/${env('GITHUB_REPOSITORY')}/actions/runs/${env('GITHUB_RUN_ID')}`,
  })
  console.log(`Recording deploy: ${outcome}`)
} else if (kind === 'check') {
  // The test suite's verdict (TESTS=success) and the home page answering in time both count
  const site = env('SITE_URL') || 'https://jodev.co.za'
  const started = performance.now()
  const home = await fetch(site, { headers: { 'user-agent': 'Mozilla/5.0 (jodev uptime check)' }, signal: AbortSignal.timeout(10_000) }).catch(() => null)
  const ms = home ? Math.round(performance.now() - started) : null
  const ok = env('TESTS') === 'success' && home?.status === 200
  sql = checkSql({ at: new Date().toISOString(), ok, ms })
  console.log(`Recording check: ${ok ? 'up' : 'DOWN'}${ms === null ? '' : `, ${ms} ms`}`)
} else {
  console.error('Usage: node scripts/status-record.ts deploy|check [--local]')
  process.exit(2)
}

// Arguments as an array, never through a shell; the schema goes first so a fresh database works
execFileSync('npx', ['wrangler', 'd1', 'execute', 'jodev', local ? '--local' : '--remote', '--command', [...STATUS_SCHEMA, sql].join('; ')], { stdio: 'inherit' })
