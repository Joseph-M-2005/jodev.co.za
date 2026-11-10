import { type ReactNode } from 'react'
import '../styles/index.css'
import { mount } from '../components/mount'
import ExternalLink from '../components/ExternalLink'

const REPO = 'https://github.com/Joseph-M-2005/jodev.co.za'

// A project, closed to its name and tagline until clicked, so the list stays short as projects are added
function Project({ kicker, name, tagline, children }: { kicker: string; name: string; tagline: string; children: ReactNode }) {
  return (
    <details className="project">
      <summary>
        <span className="kicker">{kicker}</span>
        <h2>{name}</h2>
        <span className="project-tagline">{tagline}</span>
      </summary>
      <div className="project-body">{children}</div>
    </details>
  )
}

// One part of an open project, closed until its title is clicked
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="project-section">
      <summary><h3>{title}</h3></summary>
      <div className="project-section-body">{children}</div>
    </details>
  )
}

type Step = { title: string; text: string }

// Steps in order as panels joined by arrows: a row on wide screens, stacked on narrow ones
function Flow({ label, steps }: { label: string; steps: Step[] }) {
  return (
    <figure className="flow">
      <figcaption className="flow-label">{label}</figcaption>
      <ol>
        {steps.map((s) => (
          <li key={s.title} className="panel">
            <strong>{s.title}</strong>
            <p>{s.text}</p>
          </li>
        ))}
      </ol>
    </figure>
  )
}

const pageView: Step[] = [
  { title: 'Your browser', text: 'Asks for a page, say /about.' },
  { title: "Cloudflare's network", text: 'The data centre nearest you answers.' },
  { title: 'Static files', text: 'Ready-built HTML, CSS and JavaScript. No server code runs.' },
]

const contact: Step[] = [
  { title: 'You press Send', text: 'Your browser checks the form, and Turnstile adds proof that you are human.' },
  { title: 'The Worker', text: 'Checks the rate limit, a hidden bot trap, every field and the Turnstile proof, then puts the message on a queue.' },
  { title: 'Queue', text: "Hands it to Zoho. If Zoho is down, it tries again for about half an hour, and saves anything that still won't go." },
  { title: 'Zoho Mail', text: 'Emails the message to me over SMTP.' },
]

const newRun: Step[] = [
  { title: 'A new run', text: 'I upload a run to Strava.' },
  { title: 'Webhook', text: 'Strava tells the Worker a run was added.' },
  { title: 'Double-check', text: "The Worker fetches the run from Strava itself, since webhooks aren't signed." },
  { title: 'D1 database', text: 'Saves any new personal best and my latest run.' },
  { title: 'About page', text: 'Reads a cached copy, so visitors never wait on Strava.' },
]

const release: Step[] = [
  { title: 'Build and test', text: 'Type-check, build, then test against a local copy of the Worker.' },
  { title: 'Upload green', text: 'The new version goes up with no visitors.' },
  { title: 'Test green', text: 'The same tests, on Cloudflare, at a private address.' },
  { title: 'Switch', text: 'All traffic moves to green in one step.' },
  { title: 'Check live', text: 'The tests run on jodev.co.za. If they fail, traffic goes back to blue.' },
]

// Who gets the traffic, before and after a blue-green switch
const lanes = [
  {
    when: 'Before the switch',
    rows: [
      { name: 'Blue', text: 'The live version', live: true },
      { name: 'Green', text: 'The new version, tested privately', live: false },
    ],
  },
  {
    when: 'After the switch',
    rows: [
      { name: 'Green', text: 'The new version, now live', live: true },
      { name: 'Blue', text: 'Kept ready: one command switches back', live: false },
    ],
  },
]

const highlights: { title: string; text: ReactNode }[] = [
  {
    title: 'Pixel art, drawn in code',
    text: 'Everything scales from one CSS variable: the size of a pixel. It steps up at set screen sizes instead of scaling smoothly, so the art always lands on whole pixels and stays sharp. The borders, buttons and game sprites are CSS and code-generated SVG, not image files.',
  },
  {
    title: 'A game you can play',
    text: 'The career timeline on my About page is a small platform game. You can play it with a mouse, the on-screen pad or the arrow keys. Screen readers hear each level, and it respects the reduced motion setting.',
  },
  {
    title: 'Fast by default',
    text: "Each page is its own small React app, built by Vite and served as plain files from Cloudflare's network. There's no server to wait on: the Worker only steps in for the contact form, the Strava data and the terminal card.",
  },
  {
    title: 'Locked down',
    text: 'A strict Content Security Policy and security headers on every page. Strava tokens are encrypted with AES-256 before they are stored, secrets are compared in constant time, and the webhook address is itself a secret.',
  },
  {
    title: 'Tested on every release',
    text: 'The tests run the real Worker against the built site: every page, the security headers, the 404 page and the APIs. Every release runs them three times: locally, on the new version before it is live, and on the live site after.',
  },
  {
    title: 'Hello, terminal',
    text: (
      <>
        Run <code>curl jodev.co.za</code> and you get a business card instead of HTML, with my logo drawn in coloured
        text blocks. The Worker builds it from the same SVG as the site's logo, so the two can't drift apart.
      </>
    ),
  },
]

const tech = ['React', 'TypeScript', 'Vite', 'CSS', 'Cloudflare Workers', 'Cloudflare D1', 'Cloudflare Queues', 'Cloudflare Access', 'Turnstile', 'Strava API', 'GitHub Actions', 'Node test runner']

// The tutorial videos on YouTube. Fill in before merging: the "Watch the videos" button only shows once it is set
const TUTORIALS_URL = ''

type NumberedStep = { title: string; text: string }

const makeVideo: NumberedStep[] = [
  { title: 'Claude writes the script', text: '6 to 11 short sentences and a plan for every click. I can change it before it carries on.' },
  { title: 'Claude takes the screenshots', text: 'It follows the script in the live app and saves the screen after every click and input.' },
  { title: 'Claude checks a silent draft', text: 'A render with no voice, so a wrong click or a bad zoom gets fixed early.' },
  { title: 'A local AI voice reads the script', text: 'Kokoro, a small voice model running on my laptop, reads one line per sentence.' },
  { title: 'ffmpeg builds the video', text: 'Cursor, clicks, zooms and captions, with the same intro and outro as every other video.' },
]

const remake: NumberedStep[] = [
  { title: 'Claude retakes the screenshots', text: 'The same clicks, on the updated app.' },
  { title: 'The video is rendered again', text: "One command, and it's done." },
]

// One numbered list of steps in a panel, with an optional note under it
function StepList({ label, steps, note, accent }: { label: string; steps: NumberedStep[]; note?: ReactNode; accent?: boolean }) {
  return (
    <figure className={accent ? 'step-list panel accent' : 'step-list panel'}>
      <figcaption className="flow-label">{label}</figcaption>
      <ol>
        {steps.map((s, i) => (
          <li key={s.title}>
            <span className="step-num" aria-hidden="true">{i + 1}</span>
            <div>
              <strong>{s.title}</strong>
              <p>{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
      {note && <p className="step-note">{note}</p>}
    </figure>
  )
}

const pipelineHighlights: { title: string; text: ReactNode }[] = [
  {
    title: 'Remade in minutes',
    text: 'An update to the app used to mean redoing a video from scratch. Here it means new screenshots and one command, so the videos can keep up with the app instead of falling behind it.',
  },
  {
    title: 'Still mine to edit',
    text: 'The script is a short file I can open and change. Reword a line and only that line gets re-voiced. I can move the cursor, change a zoom, slow a step down or swap the voice, then render again.',
  },
  {
    title: 'One look for every video',
    text: 'Every video goes through the same builder: the same intro and outro cards, cursor, captions, font and voice. They look like one series because they are one, and nobody has to match settings by hand.',
  },
  {
    title: 'Free and local',
    text: "The voice runs in Docker on my laptop's CPU, faster than real time, so making another video costs nothing. I tried a bigger model that sounded better, but it was five times slower than real time, so I kept the small one. I also left out voice models whose licences don't allow commercial use.",
  },
  {
    title: 'Careful on a live app',
    text: 'The videos are made on the real app with a demo account. Claude never types a password, and when a step would send an email or take a payment, it opens the dialog, shows it and clicks Cancel.',
  },
  {
    title: 'Checks its own work',
    text: 'Each render flags stray sounds in a voice line, lines read too fast or too slow, and videos outside 30 to 60 seconds, so they get fixed before anyone watches.',
  },
]

const pipelineTech = ['Claude Code', 'Chrome DevTools MCP', 'Node.js', 'ffmpeg', 'Kokoro TTS', 'Docker']

function Work() {
  return (
    <section className="section work">
      <div className="container">
        <a className="btn-raised back" href="/"><span aria-hidden="true">&lt; </span>Back</a>
        <p className="kicker">Work</p>
        <h1>Things I've <span className="nowrap">built<span className="cursor" aria-hidden="true" /></span></h1>
        <p className="lead">Projects I've built, and how they work under the hood. Click a project to open it.</p>

        <div className="projects">
          <Project kicker="Personal project · 2026" name="jodev.co.za" tagline="This site. A pixel art portfolio I designed and built from scratch.">
            <p>
              I wanted a portfolio that felt like mine, so I built it from the ground up around my pixel art logo: the
              design, the front end, the small backend behind it, the tests and the deploys. It's small, but every part
              is built the way I'd build it for production.
            </p>
            <ul className="tags" aria-label="Built with">
              {tech.map((t) => <li key={t} className="panel">{t}</li>)}
            </ul>
            <div className="actions">
              <ExternalLink className="btn" href={REPO}>View the code</ExternalLink>
              <ExternalLink className="btn btn-secondary" href={`${REPO}/blob/main/STRAVA.md`}>How the Strava sync works</ExternalLink>
            </div>

            <div className="project-sections">
              <Section title="How it works">
                <p>Three things that happen on this site, step by step.</p>
                <Flow label="Opening a page" steps={pageView} />
                <Flow label="Sending the contact form" steps={contact} />
                <Flow label="Logging a new run" steps={newRun} />
              </Section>
  
              <Section title="Highlights">
                <ul className="grid highlights">
                  {highlights.map((h) => (
                    <li key={h.title}>
                      <div className="card panel">
                        <h4>{h.title}</h4>
                        <p>{h.text}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </Section>
              <Section title="Blue-green deploys">
                <p>
                  A blue-green deploy is a cool way to ship a new version of a site with no downtime and a quick rollback if something goes wrong.
                  Normal deploys swap the live site for the new version and checks it afterwards. With blue-green, the
                  new version (green) goes up next to the live one (blue) with no visitors at all. Green is tested on the
                  real platform first, then all traffic switches over in one step. Blue stays ready, so going back takes
                  one command, and the pipeline does it on its own if the live check fails.
                </p>
                <p>
                  Using Cloudflare Workers makes this possible by splitting a release in two: uploading a version, and deploying
                  it, which decides who gets the traffic. Every version also gets its own test address. I keep those
                  behind Cloudflare Access. It's more than a small site needs, but it's how every release of this site goes out.
                  The rollback has been rehearsed, and this is the same sequence used to ship bigger apps safely.
                </p>
                <div className="lanes">
                  {lanes.map((l) => (
                    <figure key={l.when} className="panel">
                      <figcaption className="flow-label">{l.when}</figcaption>
                      <ul>
                        {l.rows.map((r) => (
                          <li key={r.name}>
                            <p><strong>{r.name}</strong> {r.text}</p>
                            <span className={r.live ? 'bar live' : 'bar'} aria-hidden="true" />
                            <p className="lane-share">{r.live ? 'All visitors' : 'No visitors'}</p>
                          </li>
                        ))}
                      </ul>
                    </figure>
                  ))}
                </div>
                <Flow label="How a release goes out" steps={release} />
                <p>Every run is logged, rollbacks and fire drills included. <a href="/status">See them on the status page</a>.</p>
              </Section>
            </div>
          </Project>

          <Project kicker="Built for MailBuddy · 2026" name="Tutorial video pipeline" tagline="Give it a topic and it makes a finished tutorial video. When the app changes, it makes it again.">
            <p>
              We needed short how-to videos for MailBuddy. I could have recorded the steps one by one manually and
              called it a day.
            </p>
            <p>
              But that has some big limitations. It takes a lot of time, and every time we change something in
              MailBuddy the videos go out of date and need to be recorded again. On top of that, every video still
              needs editing and narration.
            </p>
            <p>
              So I built an AI pipeline that handles every step on its own, and when needed I can step in and give my
              input. It all runs as one skill for Claude Code: <code>/tutorial-video "subject of the video"</code>.
            </p>
            <p>
              Claude writes the first script, which I can adjust as needed. Then Claude does the browser work: it goes
              through the app the way the script says and saves a screenshot after every click and input. After that
              the rest of the pipeline runs. A locally run AI voice reads the script, and ffmpeg turns the screenshots
              into a 30 to 60 second video with a moving cursor, click effects, zooms where needed and captions.
            </p>
            <p>
              Nothing is recorded, so when something changes in MailBuddy, I just retake the screenshots and render the
              video again.
            </p>
            <p>
              The pipeline has changed as I built it. I originally used the Higgsfield MCP for voice generation, but
              that would get costly, so I moved over to local AI.
            </p>
            <ul className="tags" aria-label="Built with">
              {pipelineTech.map((t) => <li key={t} className="panel">{t}</li>)}
            </ul>
            {TUTORIALS_URL && (
              <div className="actions">
                <ExternalLink className="btn" href={TUTORIALS_URL}>Watch the videos</ExternalLink>
              </div>
            )}

            <div className="project-sections">
              <Section title="How it works">
                <div className="step-compare">
                  <StepList label="Making a video" steps={makeVideo} />
                  <StepList
                    label="When the app changes"
                    steps={remake}
                    note={<><strong>Kept as is:</strong> the script and the voice lines.</>}
                    accent
                  />
                </div>
              </Section>

              <Section title="Highlights">
                <ul className="grid highlights">
                  {pipelineHighlights.map((h) => (
                    <li key={h.title}>
                      <div className="card panel">
                        <h4>{h.title}</h4>
                        <p>{h.text}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </Section>

              <Section title="Where Claude fits">
                <p>
                  I built the pipeline: the video builder, the voice setup and the commands that run it. I also wrote
                  the instructions Claude follows, as a Claude Code skill: how long a video should be, how to write for
                  a voice, where to aim the cursor and what it must never click on a live app.
                </p>
                <p>
                  Claude follows them. It drives the browser, writes the script and checks the drafts, and I stay in
                  charge of the result. If I want something done differently, I change the script and render it myself.
                </p>
              </Section>
            </div>
          </Project>
        </div>
      </div>
    </section>
  )
}

mount(<Work />)
