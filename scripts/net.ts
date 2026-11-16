// Fetch for the checks against the live site (test/site.test.js, scripts/status-record.ts). A network failure (the
// connection dropped, DNS, a timeout) gets another try, so one blip between GitHub's runner and Cloudflare doesn't
// count as an outage. A real answer is never retried, whatever its status: a 500 is the site's fault and must fail.
// Every failure says in plain words what went wrong.
// Retrying a POST is safe here: the checks only send ones the site refuses (bad form, wrong secret).

const WAITS_MS = [1_000, 3_000] // before the 2nd and 3rd try

// undici's error codes in words, and whether another try could help. A bad certificate won't fix itself in a second.
const CODES: Record<string, [meaning: string, transient: boolean]> = {
  ECONNRESET: ['the connection was cut mid-request', true],
  ECONNREFUSED: ['nothing accepted the connection', true],
  ECONNABORTED: ['the connection was aborted', true],
  EPIPE: ['the connection closed while the request was being sent', true],
  ETIMEDOUT: ['connecting timed out', true],
  EHOSTUNREACH: ['no route to the server', true],
  ENETUNREACH: ['no route to the network', true],
  ENOTFOUND: ['the DNS lookup found no address', true],
  EAI_AGAIN: ['the DNS lookup failed for now', true],
  UND_ERR_SOCKET: ['the connection closed unexpectedly', true],
  UND_ERR_CLOSED: ['the connection closed unexpectedly', true],
  UND_ERR_CONNECT_TIMEOUT: ['connecting timed out', true],
  UND_ERR_HEADERS_TIMEOUT: ['the server took too long to start answering', true],
  UND_ERR_BODY_TIMEOUT: ['the server took too long to send the rest of the answer', true],
}

export function describeNetError(err: unknown, timeoutMs: number): { text: string; transient: boolean } {
  if (err instanceof Error && err.name === 'TimeoutError') return { text: `no answer within ${timeoutMs / 1000}s`, transient: true }
  // fetch wraps the real error: TypeError('fetch failed', { cause })
  const cause = err instanceof Error && err.cause !== undefined ? err.cause : err
  const code = (cause as { code?: unknown } | null)?.code
  const message = cause instanceof Error ? cause.message : String(cause)
  if (typeof code === 'string' && code in CODES) {
    const [meaning, transient] = CODES[code]
    return { text: `${code}, ${meaning}`, transient }
  }
  if (typeof code === 'string' && /CERT|TLS|SSL/.test(code)) {
    return { text: `${code}, the TLS certificate or handshake was rejected (${message})`, transient: false }
  }
  return { text: typeof code === 'string' ? `${code}: ${message}` : message, transient: false }
}

const NO_BODY = [101, 204, 205, 304]

export type LiveResponse = Response & { ms: number }

export async function liveFetch(
  url: string | URL,
  init: RequestInit = {},
  { tries = 3, timeoutMs = 15_000, log = console.log } = {},
): Promise<LiveResponse> {
  const what = `${init.method ?? 'GET'} ${url}`
  for (let attempt = 1; ; attempt++) {
    try {
      const signal = AbortSignal.timeout(timeoutMs)
      const started = performance.now()
      const res = await fetch(url, { ...init, signal })
      const ms = Math.round(performance.now() - started)
      // The body is read inside the try as well, so a connection that drops partway through it gets another try too
      const body = await res.arrayBuffer()
      const copy = new Response(NO_BODY.includes(res.status) ? null : body, {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
      })
      return Object.assign(copy, { ms }) // ms: until the answer's headers arrived, on the try that got one
    } catch (err) {
      const { text, transient } = describeNetError(err, timeoutMs)
      if (!transient) throw new Error(`${what} failed: ${text}`, { cause: err })
      if (attempt >= tries) {
        throw new Error(
          `${what} got no answer after ${tries} tries: ${text}. The site never answered, so this is the network ` +
            `between the runner and Cloudflare or Cloudflare itself, not a wrong answer from the Worker`,
          { cause: err },
        )
      }
      const wait = WAITS_MS[attempt - 1] ?? WAITS_MS[WAITS_MS.length - 1]
      log(`↻ ${what}: ${text}. Trying again in ${wait / 1000}s (try ${attempt + 1} of ${tries})`)
      await new Promise((resolve) => setTimeout(resolve, wait))
    }
  }
}
