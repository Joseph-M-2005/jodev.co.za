# jodev.co.za

My personal site. React + Vite on the front, a single Cloudflare Worker on the back.

Try `curl https://jodev.co.za` too.

## What's in here

- `src/`: the pages (home, work, about, contact, cv) and their components
- `worker.ts`: the backend. Serves the static build and handles:
  - `POST /api/contact`: contact form, sent to my inbox over Zoho SMTP, behind Turnstile and a rate limit
  - `/api/strava`: running stats on the About page (see [STRAVA.md](STRAVA.md))
  - `curl` on `/`: a plain-text card instead of HTML
- `test/`: tests that run against a local copy of the Worker, or the live site

## Running it

```sh
npm install
npm run dev       # Vite only, no Worker (contact form and Strava won't work)
npm run preview   # build + full Worker on :8787
npm test          # build + tests
```

For `preview`, put the secrets in `.dev.vars`: `SMTP_PASSWORD`, `TURNSTILE_SECRET`, and the Strava ones listed in [STRAVA.md](STRAVA.md).

To test the live site instead:

```sh
SITE_URL=https://jodev.co.za node --test test/site.test.js
```

## Deploying

Manual, from GitHub Actions > Deploy > Run workflow. It's blue-green:

1. Run the tests
2. Upload the new version with no traffic and test it on its preview URL
3. Switch traffic over and check the live site
4. Roll back automatically if that check fails

PRs run the build and tests via the Check workflow.
