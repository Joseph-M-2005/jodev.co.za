import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/index.css'
import Layout from '../components/Layout'
import PathGame, { type Level } from '../components/PathGame'
import intro from '../assets/about/intro.webp'
import startline from '../assets/about/startline.webp'
import action from '../assets/about/action.webp'
import frog from '../assets/about/frog.webp'

const path: Level[] = [
  {
    from: '2020',
    to: '2023',
    name: 'Redhouse Rampage',
    icon: 'monitor',
    title: 'Freelance IT support',
    text: 'Started fixing computers, internet and phones for people around Redhouse while I was still studying. Still at it, on and off.',
  },
  {
    from: '2023',
    to: '2024',
    name: 'Sawdust Sprint',
    icon: 'saw',
    title: 'Woodworking gap year',
    text: 'Full-time at Good Shepherd Toys, working with my hands as part of a team, to real deadlines.',
  },
  {
    from: '2025',
    to: 'Now',
    name: 'Inbox Express',
    icon: 'mail',
    title: 'AR Collect',
    text: 'Frontend developer and IT support. Built the front end of MailBuddy, 40+ screens in Next.js and TypeScript.',
  },
  // The game gives the last level a Contact button
  {
    from: '????',
    name: 'Bonus Stage',
    icon: 'mystery',
    title: 'Next level',
    text: "Loading... Who knows what's next?",
  },
]

// Placeholders: these will come from the Strava API
const stats = [
  { label: '5K PB', value: '--:--' },
  { label: 'Half PB', value: '--:--' },
  { label: 'Per week', value: '-- km' },
  { label: 'Next goal', value: '???' },
]

const jumps = [
  { src: action, alt: 'Joseph running on the track at the Bestmed Madibaz race', caption: 'Bestmed Madibaz, on the track' },
  { src: frog, alt: 'Joseph in an inflatable green frog suit, mid-air, at the NMB Half Marathon', caption: 'NMB Half Marathon 2026, frog suit and all' },
]

function About() {
  return (
    <>
      <section className="section about">
        <div className="container">
          <a className="btn-raised back" href="/"><span aria-hidden="true">&lt; </span>Back</a>
          <div className="split">
            <div>
              <p className="kicker">About me</p>
              <h1>Hi, I'm <span className="nowrap">Joseph<span className="cursor" aria-hidden="true" /></span></h1>
              <p className="lead">
                I'm a frontend developer and IT support technician in Gqeberha, South Africa. I build software
                and help the people who use it.
              </p>
              <p>
                Doing both shows me where real users get stuck, so I build interfaces that are easy to use.
                I also love finding practical ways to automate the boring parts. When I'm not at a keyboard,
                I'm probably out running.
              </p>
            </div>
            <img className="photo" src={intro} alt="Joseph smiling and waving mid-race at the Knysna Forest Marathon" />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2>The path so far</h2>
          <PathGame levels={path} />
          <p className="note">The full details are on my <a href="/cv">CV</a>.</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2>Off the clock</h2>
          <div className="split">
            <div>
              <p className="lead">I'm also into endurance running. The longer the run, the better.</p>
              <p>Fun fact: I ran the NMB Half Marathon in a giant inflatable frog suit.</p>
              <ul className="grid stats">
                {stats.map((stat) => (
                  <li key={stat.label}>
                    <div className="card panel">
                      <span className="num">{stat.label}</span>
                      <p className="stat">{stat.value}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <img className="photo photo-wide" src={startline} alt="Joseph on a dark start line at the Knysna Forest Marathon" loading="lazy" />
          </div>

          <h3 className="jumps-title">Jump shots</h3>
          <p className="kicker">Press space to jump</p>
          <ul className="jumps">
            {jumps.map((jump) => (
              <li key={jump.caption}>
                <figure>
                  <img className="photo" src={jump.src} alt={jump.alt} loading="lazy" />
                  <figcaption>{jump.caption}</figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2>Reach out, or take a look at my CV</h2>
          <div className="actions">
            <a className="btn" href="/contact">Contact me</a>
            <a className="btn btn-secondary" href="/cv">See my CV</a>
          </div>
        </div>
      </section>
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Layout>
      <About />
    </Layout>
  </StrictMode>,
)
