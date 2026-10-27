import { useEffect, useState } from 'react'

// Shape of GET /api/strava (strava.ts publicData)
type Effort = { name: string; seconds: number; date: string; activityId: number }
type Data = { bestEfforts: Effort[]; ytd: { runs: number; metres: number; seconds: number } | null }

const DISTANCES = ['5K', '10K', 'Half Marathon', 'Marathon']

const pad = (n: number) => String(n).padStart(2, '0')
// 19:42 or 1:05:09
const time = (seconds: number) => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h ? `${h}:${pad(m)}:${pad(seconds % 60)}` : `${m}:${pad(seconds % 60)}`
}
// The API sends dates only; reading them as UTC keeps the day from shifting
const day = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

// Strava Best Efforts and this year's totals, live from the Worker. `goal` is the one card typed in by hand.
export default function StravaStats({ goal }: { goal: string }) {
  const [data, setData] = useState<Data>()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    // Plain `npm run dev` has no Worker, so this fails there and shows the fallback line
    fetch('/api/strava')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then(setData, () => setFailed(true))
  }, [])

  if (failed) return <p className="note">Couldn't load the Strava stats right now.</p>
  const ytd = data?.ytd
  const value = (text: string | null | undefined) => (data ? (text ?? '--') : '...')

  return (
    <div className="strava" aria-busy={!data}>
      <h3 className="strava-title">Strava Best Efforts</h3>
      <ul className="grid strava-grid">
        {DISTANCES.map((name) => {
          const effort = data?.bestEfforts.find((e) => e.name === name)
          return (
            <li key={name}>
              <div className="card panel">
                <span className="num">{name}</span>
                <p className="stat">{value(effort && time(effort.seconds))}</p>
                {effort ? (
                  <p className="stat-note">
                    <span className="stat-date">{day(effort.date)}</span> <a className="strava-link" href={`https://www.strava.com/activities/${effort.activityId}`}>View on Strava</a>
                  </p>
                ) : (
                  data && <p className="stat-note">Not yet</p>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <h3 className="strava-title">This year</h3>
      <ul className="grid strava-grid">
        {/* Whole numbers so each value fits on one line in the card */}
        <li><div className="card panel"><span className="num">Distance</span><p className="stat">{value(ytd && `${Math.round(ytd.metres / 1000)} km`)}</p></div></li>
        <li><div className="card panel"><span className="num">Runs</span><p className="stat">{value(ytd && String(ytd.runs))}</p></div></li>
        <li><div className="card panel"><span className="num">Time</span><p className="stat">{value(ytd && `${Math.round(ytd.seconds / 3600)} h`)}</p></div></li>
        <li><div className="card panel"><span className="num">Next goal</span><p className="stat">{goal}</p></div></li>
      </ul>

      {/* Strava's brand guidelines: their logo, unmodified, wherever their data is shown */}
      <a className="strava-logo" href="https://www.strava.com"><img src="/powered-by-strava.svg" alt="Powered by Strava" width="183" height="19" /></a>
    </div>
  )
}
