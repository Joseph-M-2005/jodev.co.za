import type { ReactNode } from 'react'
import ExternalLink from './ExternalLink'

const nav = [
  { href: '/work', label: 'Work' },
  { href: '/about', label: 'About' },
  { href: '/cv', label: 'CV' },
  { href: '/contact', label: 'Contact' },
]

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header">
        <div className="container">
          <a className="brand" href="/">
            <img src="/favicon.svg" alt="" />
            jodev
          </a>
          <nav aria-label="Main">
            <ul className="nav-list">
              {nav.map((item) => (
                <li key={item.href}><a href={item.href}>{item.label}</a></li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1}>{children}</main>
      <footer className="site-footer">
        <div className="container">
          <p>© {new Date().getFullYear()} Joseph Mitchell</p>
          <ExternalLink href="https://github.com/Joseph-M-2005">GitHub</ExternalLink>
        </div>
      </footer>
    </>
  )
}
