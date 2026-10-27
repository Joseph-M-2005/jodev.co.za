import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import PadButton from './PadButton'
import { ICONS, Pixels, RUNNER, Scene, type IconName } from './pathArt'

export type Level = { from: string; to?: string; name: string; title: string; text: string; icon: IconName }

const years = (l: Level, sep = ' - ') => (l.to ? `${l.from}${sep}${l.to}` : l.from)

const RUN_MS = 700 // per level travelled
const JUMP_MS = 480

// Every level sits on one screen along a path; the runner runs between them.
// The last level is the "next level" one, with a link to the contact page.
export default function PathGame({ levels }: { levels: Level[] }) {
  const [level, setLevel] = useState(0)
  const [runMs, setRunMs] = useState(0)
  const [running, setRunning] = useState(false)
  const [facingLeft, setFacingLeft] = useState(false)
  const [jumping, setJumping] = useState(false)
  const runTimer = useRef<number>(undefined)
  const jumpTimer = useRef<number>(undefined)
  const nodes = useRef<(HTMLButtonElement | null)[]>([])
  const last = levels.length - 1
  const x = (i: number) => ((i + 0.5) / levels.length) * 100

  useEffect(() => () => {
    clearTimeout(runTimer.current)
    clearTimeout(jumpTimer.current)
  }, [])

  function go(to: number, focusNode = false) {
    if (to < 0 || to > last) return
    if (focusNode) nodes.current[to]?.focus()
    if (to === level) return
    const ms = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : RUN_MS * Math.abs(to - level)
    setFacingLeft(to < level)
    setRunMs(ms)
    setLevel(to)
    setRunning(ms > 0)
    // A timer rather than transitionend, which never fires when the move is instant
    clearTimeout(runTimer.current)
    runTimer.current = window.setTimeout(() => setRunning(false), ms)
  }

  function jump() {
    setJumping(true)
    clearTimeout(jumpTimer.current)
    jumpTimer.current = window.setTimeout(() => setJumping(false), JUMP_MS)
  }

  // Left/right move between levels (and the focus with them, from a level button); up or space jumps.
  // Space is taken from the buttons here, like in a game; Enter still presses them.
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const onNode = (e.target as HTMLElement).classList.contains('node')
    if (e.key === 'ArrowRight') go(level + 1, onNode)
    else if (e.key === 'ArrowLeft') go(level - 1, onNode)
    else if (e.key === 'ArrowUp' || e.key === ' ') jump()
    else return
    e.preventDefault()
  }

  // Buttons click on space's keyup, so stop that too
  function onKeyUp(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === ' ') e.preventDefault()
  }

  const current = levels[level]
  const runner = ['runner', running && 'running', jumping && 'jumping', facingLeft && 'left'].filter(Boolean).join(' ')

  return (
    <div className="path-game" onKeyDown={onKeyDown} onKeyUp={onKeyUp}>
      <div className="game" style={{ '--x': x(level), '--run-ms': `${runMs}ms` } as CSSProperties}>
        <Scene />
        <p className="game-hud" aria-hidden="true">
          <span>Level {level + 1}<span className="hud-name"> · {current.name}</span></span>
          <span>{years(current)}</span>
        </p>
        {/* Signs are a bigger click target for the level buttons below, so they stay out of the tab order */}
        {levels.map((l, i) => (
          <div key={l.title} className={i === level ? 'sign current' : 'sign'} style={{ left: `${x(i)}%` }} aria-hidden="true" onClick={() => go(i)}>
            <Pixels frames={[ICONS[l.icon]]} />
            {/* No spaces, so neighbouring signs don't touch at tablet widths */}
            <span className="sign-year">{years(l, '-')}</span>
          </div>
        ))}
        <div className={runner} aria-hidden="true">
          <Pixels className="runner-sheet" frames={RUNNER} />
        </div>
        <ol className="nodes">
          {levels.map((l, i) => (
            <li key={l.title} style={{ left: `${x(i)}%` }}>
              <button
                ref={(el) => { nodes.current[i] = el }}
                type="button"
                className={i < level ? 'node done' : 'node'}
                aria-current={i === level ? 'step' : undefined}
                aria-label={`Level ${i + 1}, ${years(l)}: ${l.title}`}
                onClick={() => go(i)}
              >
                {i + 1}
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="game-dialog">
        <div className="game-panel game-info">
          {/* Every level's text sits in the same cell so the box never changes height; only the current one shows.
              Screen readers get the live line below instead. */}
          <div className="game-text">
            {levels.map((l, i) => (
              <div key={l.title} className={i === level && !running ? 'shown' : undefined}>
                <div className="game-entry">
                  <Pixels className="game-icon" frames={[ICONS[l.icon]]} />
                  <div>
                    <div aria-hidden="true">
                      <p className="game-kicker">{l.name} · {years(l)}</p>
                      <h3>{l.title}</h3>
                      <p>{l.text}</p>
                    </div>
                    {i === last && <a className="btn" href="/contact">Contact me</a>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="sr-only" aria-live="polite">
            {!running && `Level ${level + 1}, ${years(current)}: ${current.title}. ${current.text}`}
          </p>
        </div>

        <div className="game-panel game-pad">
          <p className="pad-label" aria-hidden="true">Navigate | Interact</p>
          <div className="pad-buttons">
            <PadButton arrow="left" label="Previous level" disabled={level === 0} onClick={() => go(level - 1)} />
            <PadButton arrow="right" label="Next level" disabled={level === last} onClick={() => go(level + 1)} />
            <PadButton arrow="up" label="Jump" onClick={jump} />
          </div>
        </div>
      </div>
    </div>
  )
}
