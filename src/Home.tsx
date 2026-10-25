export default function Home() {
  return (
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
            <a className="btn" href="/work">See my work</a>
            <a className="btn btn-secondary" href="/contact">Contact me</a>
          </div>
        </div>
        <img className="hero-logo" src="/favicon.svg" alt="" />
      </div>
    </section>
  )
}
