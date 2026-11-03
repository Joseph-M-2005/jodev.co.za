import { StrictMode, useEffect, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/index.css'
import Layout from '../components/Layout'
import ExternalLink from '../components/ExternalLink'
import { day, time, type Data } from '../components/StravaStats'

function Card({ kicker, title, link, href, children }: { kicker: string; title: string; link: string; href: string; children: ReactNode }) {
  return (
    <li>
      <div className="card panel">
        <span className="num">{kicker}</span>
        <h2>{title}</h2>
        <div className="card-body">{children}</div>
        <a className="card-link" href={href}>{link}<span aria-hidden="true"> &gt;</span></a>
      </div>
    </li>
  )
}

// 5:01 /km, from moving time like Strava shows it
const pace = (seconds: number, metres: number) => `${time(Math.round(seconds / (metres / 1000)))} /km`
// "2 Nov", with the year only if it isn't this year
const shortDay = (date: string) => (date.startsWith(String(new Date().getFullYear())) ? day(date).replace(/ \d{4}$/, '') : day(date))

// This year's km and runs, and my latest run. Plain `npm run dev` has no Worker, so there it falls back to a line of text.
function RunCard() {
  const [data, setData] = useState<Data>()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetch('/api/strava')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then(setData, () => setFailed(true))
  }, [])

  const ytd = data?.ytd
  const last = data?.latestRun
  return (
    <Card kicker="Running" title="Off the clock" link="My PBs" href="/about#running">
      {failed || (data && !ytd && !last) ? (
        <p>When I'm not coding, I'm usually out running.</p>
      ) : (
        <>
          {(!data || ytd) && (
            <p aria-busy={!data}>
              <span className="stat">{ytd ? Math.round(ytd.metres / 1000) : '...'} km</span> and{' '}
              <span className="stat">{ytd ? ytd.runs : '...'}</span> runs so far this year.
            </p>
          )}
          {last && (
            <p>
              Last run: {(last.metres / 1000).toFixed(1)} km in {time(last.seconds)} <span className="nowrap">({pace(last.seconds, last.metres)})</span> on{' '}
              <span className="nowrap">{shortDay(last.date)}</span>.
              <ExternalLink className="strava-link" href={`https://www.strava.com/activities/${last.activityId}`}>View on Strava</ExternalLink>
            </p>
          )}
          {/* Strava's brand guidelines: their logo wherever their data is shown */}
          <ExternalLink className="strava-logo" href="https://www.strava.com"><img src="/powered-by-strava.svg" alt="Powered by Strava" width="183" height="19" /></ExternalLink>
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Layout>
      <Home />
    </Layout>
  </StrictMode>,
)
