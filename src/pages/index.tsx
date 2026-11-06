import { useEffect, useState, type ReactNode } from 'react'
import '../styles/index.css'
import { mount } from '../components/mount'
import ExternalLink from '../components/ExternalLink'
import { day, time, type Data } from '../components/StravaStats'

function Card({ kicker, title, link, href, extra, children }: { kicker: string; title: string; link: string; href: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <li>
      <div className="card panel">
        <p className="kicker">{kicker}</p>
        <h2>{title}</h2>
        <div className="card-body">{children}</div>
        <div className="card-foot">
          {extra}
          <a className="card-link" href={href}>{link}<span aria-hidden="true"> &gt;</span></a>
        </div>
      </div>
    </li>
  )
}

// 5:01 /km, from moving time like Strava shows it
const pace = (seconds: number, metres: number) => `${time(Math.round(seconds / (metres / 1000)))} /km`
// "2 Nov", with the year only if it isn't this year
const shortDay = (date: string) => (date.startsWith(String(new Date().getFullYear())) ? day(date).replace(/ \d{4}$/, '') : day(date))

// My latest run. Plain `npm run dev` has no Worker, so there it falls back to a line of text.
function RunCard() {
  const [data, setData] = useState<Data>()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetch('/api/strava')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then(setData, () => setFailed(true))
  }, [])

  const last = data?.latestRun
  // Strava's brand guidelines: their logo wherever their data is shown
  const logo = last && (
    <ExternalLink className="strava-logo" href="https://www.strava.com"><img src="/powered-by-strava.svg" alt="Powered by Strava" width="183" height="19" /></ExternalLink>
  )
  return (
    <Card kicker="Running" title="My last run" link="My PBs" href="/about#running" extra={logo}>
      {failed || (data && !last) ? (
        <p>When I'm not coding, I'm usually out running.</p>
      ) : (
        <>
          {/* Numbers in Press Start 2P: Pixelify's digits are hard to read */}
          <dl className="run-stats" aria-busy={!data}>
            <div><dt>Distance</dt><dd className="stat">{last ? `${(last.metres / 1000).toFixed(1)} km` : '...'}</dd></div>
            <div><dt>Time</dt><dd className="stat">{last ? time(last.seconds) : '...'}</dd></div>
            <div><dt>Pace</dt><dd className="stat">{last ? pace(last.seconds, last.metres) : '...'}</dd></div>
          </dl>
          {last && (
            <p className="run-date">
              <span className="stat-date">{shortDay(last.date)}</span>
              <ExternalLink className="strava-link" href={`https://www.strava.com/activities/${last.activityId}`}>View on Strava</ExternalLink>
            </p>
          )}
        </>
      )}
    </Card>
  )
}

function Home() {
  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <p className="kicker">Hi, I'm Joseph Mitchell</p>
            {/* nowrap keeps the cursor on the same line as the last word on narrow phones */}
            <h1>I Build <span className="nowrap">Stuff<span className="cursor" aria-hidden="true" /></span></h1>
            <p className="lead">
              Frontend developer in Gqeberha, South Africa. I build interfaces people find easy to use,
              and I love automating the boring parts.
            </p>
            <div className="actions">
              <a className="btn" href="/about">About me</a>
              <a className="btn btn-secondary" href="/contact">Contact me</a>
            </div>
          </div>
          <img className="hero-logo" src="/favicon.svg" alt="" />
        </div>
      </section>

      <section className="section home-cards">
        <div className="container">
          <ul className="grid">
            <Card kicker="Latest project" title="jodev.co.za" link="How I built it" href="/work">
              <p>This site. I built all of it myself, from the pixel art to the deploys.</p>
            </Card>
            <RunCard />
          </ul>
        </div>
      </section>
    </>
  )
}

mount(<Home />)
