# jodev.co.za

My personal site.
Try `curl https://jodev.co.za`

## The fun parts

**Pixel art** The look is built to match the pixel art logo. Everything snaps to a pixel grid that scales in steps, so the art is never blurry on any screen size.

**Page transitions.** Moving between pages, the parts both pages share (the logo, the heading, the Back button, a
home card and the page it links to) glide from one spot to the next, and the rest fades across. 
Links start loading in the background when you hover them, so most pages open almost instantly.

**A little game on the About page.** A runner runs between the levels as you pick them, and the last one is "next level", with a link to get in touch.

**Live running stats.** The About and home pages show my Strava best efforts, this year's totals and my latest run.
This is using Webhooks so that there is not a cron job checking when a new run is uploaded. this also means new runs are displayed right away. check the full explination.
[STRAVA.md](STRAVA.md).

**The contact form doesn't lose messages.** It's behind Cloudflare Turnstile, a bot trap and a rate limiter.
Messages go on a queue and get emailed to me, it retries for about half an hour when needed. Anything that still fails is
saved in a database instead of being dropped.
I won't check it.. but I could if I wanted to..

**A terminal version.** `curl` the homepage and you get a plain-text card with the logo drawn in coloured blocks.

**Blue-green deploys.** A new version goes up next to the live one with no traffic, gets tested at its own (private) URL,
and only then takes over. If the live site fails its check after the switch, it rolls back on its own. There's a
fire drill option that fails the check on purpose, to prove the rollback still works.

**A status page.** [jodev.co.za/status](https://jodev.co.za/status) shows every deploy and how it went, plus
uptime. Every 30 minutes, the site triggers GitHub to run the same tests that a release has to pass, but against the live site. The tests themselves run on GitHub, not Cloudflare. Cloudflare is simply responsible for triggering them.

It's a little odd having the site trigger its own health checks, but I've found GitHub's built-in cron scheduler is very unreliable (pretty much always the case with GitHub).

I may change this in the future, though, as it does mean that if Cloudflare goes down, the checks won't run either. And if Cloudflare is down, so is my site.

(there is the backup schedule run hourly by github.. but I don't trust it)

## What it's built with

React, TypeScript, Vite, CSS, Cloudflare Workers, D1, Queues, Access and Turnstile, the Strava API, GitHub Actions
and the Node test runner. 
