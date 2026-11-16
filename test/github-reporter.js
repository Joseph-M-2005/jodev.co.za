// Puts the live-site tests' failures and network retries on a GitHub Actions run's summary page (annotations, plus
// a section in the job summary), so a red Uptime or Deploy run says what broke without digging through the log.
// Runs next to the usual spec output: `npm run test:site`. Outside GitHub Actions it prints nothing.
import { appendFileSync } from 'node:fs'
import { relative } from 'node:path'

const ci = process.env.GITHUB_ACTIONS === 'true'
// Workflow command escaping: data, then properties (title=, file=) which also can't hold : or ,
const data = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
const prop = (s) => data(s).replace(/:/g, '%3A').replace(/,/g, '%2C')

export default async function* githubReporter(source) {
  const failures = []
  const retries = []
  let passed = 0
  for await (const { type, data: event } of source) {
    if (type === 'test:pass' && !event.skip && event.details?.type !== 'suite') passed++
    // A parent that failed only because a test inside it did adds nothing
    if (type === 'test:fail' && event.details?.error?.failureType !== 'subtestsFailed') {
      const error = event.details?.error
      const cause = error?.cause ?? error
      failures.push({
        name: event.name,
        file: event.file ? relative(process.cwd(), event.file) : undefined,
        line: event.line,
        message: String(cause?.message ?? cause ?? 'failed').slice(0, 2000),
      })
    }
    // scripts/net.ts logs each retry with this mark
    if (type === 'test:stdout' && event.message.includes('↻')) retries.push(event.message.trim())
  }
  if (!ci) return

  for (const line of retries) yield `::warning title=Network retry::${data(line)}\n`
  for (const f of failures) {
    const where = f.file ? `file=${prop(f.file)}${f.line ? `,line=${f.line}` : ''},` : ''
    yield `::error ${where}title=${prop(f.name)}::${data(f.message)}\n`
  }

  if (process.env.GITHUB_STEP_SUMMARY && (failures.length || retries.length)) {
    const site = process.env.SITE_URL || 'the local Worker'
    const lines = [`### Site tests against ${site}: ${failures.length} failed, ${passed} passed`, '']
    for (const f of failures) lines.push(`- **${f.name}**`, '', '  ```', ...f.message.split('\n').map((l) => `  ${l}`), '  ```')
    if (retries.length) lines.push('', `Network retries (${retries.length}):`, '', ...retries.map((r) => `- ${r}`))
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n\n')
  }
}
