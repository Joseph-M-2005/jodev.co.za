import type { CSSProperties } from 'react'
import { Pixels } from './pathArt'

// Press Start 2P's > glyph as pixel art; left and up are the same shape turned, so all three match
const RIGHT = ['nn...', '.nn..', '..nn.', '...nn', '..nn.', '.nn..', 'nn...']
const mirror = (art: string[]) => art.map((row) => [...row].reverse().join(''))
const turnLeft = (art: string[]) => [...art[0]].map((_, r) => art.map((row) => row[row.length - 1 - r]).join(''))

export const ARROWS = { left: mirror(RIGHT), right: RIGHT, up: turnLeft(RIGHT) }

type Props = { arrow: keyof typeof ARROWS; label: string; disabled?: boolean; onClick: () => void }

// Solid blue arcade button with a pixel arrow. aria-disabled, not disabled, so focus isn't dropped when it switches off.
export default function PadButton({ arrow, label, disabled = false, onClick }: Props) {
  const art = ARROWS[arrow]
  return (
    <button
      type="button"
      className="pad-btn"
      aria-label={label}
      aria-disabled={disabled}
      onClick={onClick}
      style={{ '--cols': art[0].length } as CSSProperties}
    >
      <Pixels frames={[art]} />
    </button>
  )
}
