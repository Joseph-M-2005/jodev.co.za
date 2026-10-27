import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/index.css'
import Layout from '../components/Layout'
import PathGame, { type Level } from '../components/PathGame'
import SectionRail, { type Section } from '../components/SectionRail'
import StravaStats from '../components/StravaStats'
import intro from '../assets/about/intro.webp'
import introFace from '../assets/about/intro-face.webp'
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

// The one running stat not from Strava
const NEXT_GOAL = '???'

const sections: Section[] = [
  { id: 'intro', label: 'Intro' },
  { id: 'path', label: 'The path so far' },
  { id: 'running', label: 'Off the clock' },
  { id: 'contact', label: 'Contact' },
]

const jumps = [
  { src: action, alt: 'Joseph running on the track at the Bestmed Madibaz race', caption: 'Bestmed Madibaz, on the track' },
  { src: frog, alt: 'Joseph in an inflatable green frog suit, mid-air, at the NMB Half Marathon', caption: 'NMB Half Marathon 2026, frog suit and all' },
]

function About() {
  return (
    <>
      <SectionRail sections={sections} />

      <section id="intro" className="section about">
        <div className="container">
          <a className="btn-raised back" href="/"><span aria-hidden="true">&lt; </span>Back</a>
          <div className="intro">
            <div className="intro-head">
              <p className="kicker">About me</p>
              <h1>Hi, I'm <span className="nowrap">Joseph<span className="cursor" aria-hidden="true" /></span></h1>
            </div>
            {/* Phones get a face crop, small beside the heading */}
            <picture className="intro-photo">
              <source media="(max-width: 899px)" srcSet={introFace} />
              <img className="photo" src={intro} alt="Joseph smiling and waving mid-race at the Knysna Forest Marathon" />
            </picture>
            <div className="intro-body">
              <p className="lead">
                I live in Gqeberha, South Africa, and work at AR Collect as a frontend developer and IT support
                technician. I get to build the software and help the people who use it.
              </p>
              <p>
                Doing both shows me where real users get stuck, so I build interfaces that are easy to use.
                I also love finding practical ways to automate the boring parts. When I'm not at a keyboard,
                I'm probably out running.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="path" className="section">
        <div className="container">
          <h2>The path so far</h2>
          <PathGame levels={path} />
          <p className="note">The full details are on my <a href="/cv">CV</a>.</p>
        </div>
      </section>

      <section id="running" className="section">
        <div className="container">
          <h2>Off the clock</h2>
          <div className="split">
            <div>
              <p className="lead">I'm also into endurance running. The longer the run, the better.</p>
              <p>Fun fact: I ran the NMB Half Marathon in a giant inflatable frog suit.</p>
            </div>
            <img className="photo photo-wide" src={startline} alt="Joseph on a dark start line at the Knysna Forest Marathon" loading="lazy" />
          </div>

          <StravaStats goal={NEXT_GOAL} />

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

      <section id="contact" className="section">
        <div className="container">
          <h2>Say hi, or take a look at my CV</h2>
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
