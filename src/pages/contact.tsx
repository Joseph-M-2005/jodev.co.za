import { StrictMode, useEffect, useRef, useState, type FormEvent } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/index.css'
import Layout from '../components/Layout'
import ExternalLink from '../components/ExternalLink'

declare global {
  interface Window {
    turnstile?: {
      render(el: HTMLElement, options: { sitekey: string; theme?: 'auto' | 'light' | 'dark' }): string
      reset(id: string): void
      remove(id: string): void
    }
  }
}

const EMAIL = 'joseph@jodev.co.za'
const FALLBACK = `Couldn't send right now. Email me at ${EMAIL} instead.`
// Site keys are public. Anywhere but the live site uses Cloudflare's always-pass test key.
const TURNSTILE_SITE_KEY = location.hostname.endsWith('jodev.co.za') ? '0x4AAAAAAFlYUOAilzAI3CWq' : '1x00000000000000000000AA'

function Contact() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')
  const captchaBox = useRef<HTMLDivElement>(null)
  const captchaId = useRef<string>(undefined)

  useEffect(() => {
    // If an ad blocker stops Turnstile loading, the page still works and the Worker refuses the send with a clear message
    const { turnstile } = window
    if (!turnstile || !captchaBox.current) return
    const id = turnstile.render(captchaBox.current, { sitekey: TURNSTILE_SITE_KEY, theme: 'dark' })
    captchaId.current = id
    return () => turnstile.remove(id)
  }, [])

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    if (!String(data.get('email')).trim() && !String(data.get('phone')).trim()) {
      setStatus('error')
      setError('Add an email or phone number so I can reply.')
      return
    }

    setStatus('sending')
    let message = ''
    try {
      const res = await fetch('/api/contact', { method: 'POST', body: data })
      if (res.ok) {
        // Only clear the form once it's sent, so a failed send never loses what they typed
        form.reset()
        setStatus('sent')
      } else {
        message = (await res.json().catch(() => null))?.error || FALLBACK
      }
    } catch {
      message = FALLBACK
    }
    // Turnstile tokens are single-use, so fetch a fresh one for the next send
    if (captchaId.current) window.turnstile?.reset(captchaId.current)
    if (message) {
      setStatus('error')
      setError(message)
    }
  }

  return (
    <section className="section contact">
      <div className="container">
        <a className="btn-raised back" href="/"><span aria-hidden="true">&lt; </span>Back</a>
        <h1>Contact</h1>
        <p className="lead">Got a question? Send me a message and I'll get back to you.</p>

        <div className="contact-grid">
          <form className="panel" onSubmit={onSubmit}>
            <h2>Send a message</h2>
            <label className="field">
              <span>Name</span>
              <input className="input" name="name" required maxLength={100} autoComplete="name" />
            </label>
            <p className="hint" id="reach-hint">Leave an email, a phone number or both, so I can reply.</p>
            <label className="field">
              <span>Email</span>
              <input className="input" name="email" type="email" maxLength={254} autoComplete="email" aria-describedby="reach-hint" />
            </label>
            <label className="field">
              <span>Phone</span>
              <input
                className="input"
                name="phone"
                type="tel"
                maxLength={20}
                pattern="\+?[\d \(\)\-]{7,20}"
                title="Digits, spaces and + ( ) -"
                autoComplete="tel"
                aria-describedby="reach-hint"
              />
            </label>
            <label className="field">
              <span>Message</span>
              <textarea className="input" name="message" required maxLength={5000} rows={6} />
            </label>
            {/* Honeypot: hidden from people, bots fill it in and the Worker drops the message */}
            <label className="hp" aria-hidden="true">
              Website <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
            {/* Turnstile adds a hidden cf-turnstile-response input here, so the token goes up with the form */}
            <div ref={captchaBox} />
            <div className="form-foot">
              <button className="btn" disabled={status === 'sending'}>
                {status === 'sending' ? 'Sending...' : 'Send'}
              </button>
              {/* Always rendered so screen readers announce it when the text appears */}
              <p role="status">{status === 'sent' && "Thanks! Your message is on its way. I'll reply soon."}</p>
              {status === 'error' && <p className="form-error" role="alert">{error}</p>}
            </div>
          </form>

          <aside className="panel">
            <h2>Email me</h2>
            <p>Rather use your own mail app? Write to me directly.</p>
            <ul className="direct-list">
              <li><a href={`mailto:${EMAIL}`}>{EMAIL}</a></li>
              <li><ExternalLink href="https://www.linkedin.com/in/joseph-mitchell-2005-profile/">LinkedIn</ExternalLink></li>
              <li><ExternalLink href="https://github.com/Joseph-M-2005">GitHub</ExternalLink></li>
              <li>Gqeberha, South Africa</li>
            </ul>
          </aside>
        </div>
      </div>
    </section>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Layout>
      <Contact />
    </Layout>
  </StrictMode>,
)
