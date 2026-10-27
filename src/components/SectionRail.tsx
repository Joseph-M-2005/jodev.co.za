import { useEffect, useState } from 'react'

export type Section = { id: string; label: string }

// Level select down the right edge: one node per section of the page, lit up to the one in view.
// Shows there's more below the fold, and jumps there (plain anchors, so it works without JS too).
export default function SectionRail({ sections }: { sections: Section[] }) {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    const els = sections.map((s) => document.getElementById(s.id))
    // The last section starting above the middle of the screen; at the very bottom, the last one,
    // which is too short to ever reach the middle
    function update() {
      const atEnd = innerHeight + scrollY >= document.documentElement.scrollHeight - 1
      setCurrent(atEnd ? els.length - 1 : Math.max(0, els.findLastIndex((el) => el && el.getBoundingClientRect().top < innerHeight / 2)))
    }
    update()
    addEventListener('scroll', update, { passive: true })
    addEventListener('resize', update)
    return () => {
      removeEventListener('scroll', update)
      removeEventListener('resize', update)
    }
  }, [sections])

  return (
    <nav className="rail" aria-label="Page sections">
      <ol>
        {sections.map((s, i) => (
          <li key={s.id}>
            <a
              className={i < current ? 'node done' : 'node'}
              href={`#${s.id}`}
              aria-current={i === current ? 'location' : undefined}
              aria-label={`Section ${i + 1}, ${s.label}`}
              title={s.label}
            >
              {i + 1}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
