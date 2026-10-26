import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/index.css'
import Layout from '../components/Layout'

// Shared placeholder for pages that aren't built yet; the page name comes from <div id="root" data-page>.
const root = document.getElementById('root')!

createRoot(root).render(
  <StrictMode>
    <Layout>
      <section className="hero placeholder">
        <div className="container">
          <p className="kicker">{root.dataset.page}</p>
          <h1>Coming soon<span className="cursor" aria-hidden="true" /></h1>
          <a className="btn" href="/">Go home</a>
        </div>
      </section>
    </Layout>
  </StrictMode>,
)
