// Starts the Uptime GitHub workflow every 30 minutes from the Worker's cron (wrangler.jsonc triggers). GitHub's own
// schedule skipped most runs; a workflow_dispatch starts within seconds. The checks themselves still run on GitHub,
// outside Cloudflare, so they can see an outage the Worker can't. The workflow keeps its own schedule as a backup for
// when Cloudflare (and so this trigger) is down.
// No runtime imports, so the Node tests can load this file.

export const UPTIME_CRON = '13,43 * * * *'
const DISPATCH_URL = 'https://api.github.com/repos/Joseph-M-2005/jodev.co.za/actions/workflows/uptime.yml/dispatches'

export interface UptimeEnv {
  // Fine-grained GitHub token: this repo only, Actions read and write, nothing else
  GITHUB_DISPATCH_TOKEN?: string
}

export async function triggerUptime(env: UptimeEnv, fetcher: typeof fetch = fetch): Promise<void> {
  if (!env.GITHUB_DISPATCH_TOKEN) {
    console.error('Uptime trigger skipped: GITHUB_DISPATCH_TOKEN is not set')
    return
  }
  const res = await fetcher(DISPATCH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      // GitHub refuses API requests without one
      'User-Agent': 'jodev.co.za uptime trigger',
    },
    body: JSON.stringify({ ref: 'main' }),
  })
  // 204 on success. Anything else goes to the Worker logs; the next run tries again in 30 minutes.
  if (!res.ok) console.error('Uptime trigger failed', res.status, (await res.text()).slice(0, 200))
}
