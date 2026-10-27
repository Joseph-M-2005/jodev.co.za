// Pixel art for the About page's path game, drawn in code so it stays crisp at every --px step.
// Each piece is rows of letters, one per pixel ('.' is empty), coloured through PALETTE.
type Art = string[]

const PALETTE: Record<string, string> = {
  // Runner (capitals are the far-side limbs)
  h: '#c8662b', b: '#a4501f', s: '#f2c4a0', S: '#d29a78', e: '#0b0d1a',
  v: '#1b3a5c', y: '#f2c230', k: '#14151c', K: '#2a2c38', t: '#2bb3a3', T: '#1d7f74',
  // Icons and scenery
  n: '#0b0d1a', d: '#1f4eab', c: '#12a2e5', w: '#e8ecff', l: '#8fa3e8', M: '#c5cdf5',
  u: '#b07a45', U: '#7d5330', r: '#5a44bf', q: '#363b82', Q: '#2c3070', z: '#1a1d4a', Z: '#252a63',
}

// One rect per run of same-coloured pixels in a row, like favicon.svg
function rects(art: Art, dx = 0) {
  return art.flatMap((row, y) =>
    [...row.matchAll(/([^.])\1*/g)].map((m) => ({ x: dx + m.index, y, width: m[0].length, fill: PALETTE[m[1]] })),
  )
}

// Frames side by side in one SVG; the runner's CSS slides through them
export function Pixels({ frames, className }: { frames: Art[]; className?: string }) {
  const w = frames[0][0].length
  return (
    <svg className={className} viewBox={`0 0 ${w * frames.length} ${frames[0].length}`} shapeRendering="crispEdges" aria-hidden="true">
      {frames.flatMap((art, f) => rects(art, f * w)).map((r, i) => <rect key={i} {...r} height={1} />)}
    </svg>
  )
}

function Sprite({ art, x, y }: { art: Art; x: number; y: number }) {
  return <g transform={`translate(${x} ${y})`}>{rects(art).map((r, i) => <rect key={i} {...r} height={1} />)}</g>
}

// Mini Joseph, 16x20: stand, run x3, jump
const HEAD = [
  '................',
  '.......hhhhh....',
  '......hhhhhhh...',
  '......hhhsssss..',
  '......hhsssess..',
  '......hsssssss..',
  '......hbsssss...',
  '.......bbbbbb...',
  '........bbbb....',
]
export const RUNNER = [
  [
    '.......svvvs....',
    '......svvyvvs...',
    '......svyyvvs...',
    '......svvvyvs...',
    '......Svvvvys...',
    '.......kkkkk....',
    '.......kk.kk....',
    '.......ss.ss....',
    '.......ss.ss....',
    '.......kk.kk....',
    '.......tt.ttt...',
  ],
  [
    '.......vvvvs....',
    '......Svyvvvs.s.',
    '.....S.vyyvv.ss.',
    '.....S.vvvyv....',
    '.......vvvvy....',
    '.......kkkkkk...',
    '......KKk..kkk..',
    '.....SS.....ss..',
    '....SS.......ss.',
    '...KK.........k.',
    '..TT.........ttt',
  ],
  [
    '.......vvvvs....',
    '.......vyvvvs...',
    '......Svyyvvs...',
    '......Svvvyvs...',
    '.......vvvvy....',
    '.......kkkkk....',
    '.......kkkkkss..',
    '.......SS...ss..',
    '........SS..k...',
    '........KK..tt..',
    '........TTT.....',
  ],
  [
    '.......vvvvs....',
    '......svyvvvS.S.',
    '.....s.vyyvv.SS.',
    '.....s.vvvyv....',
    '.......vvvvy....',
    '.......kkkkkk...',
    '......kkK..KKK..',
    '.....ss.....SS..',
    '....ss.......SS.',
    '...kk.........K.',
    '..tt.........TTT',
  ],
  [
    '...s...vvvvs..s.',
    '....s.svyvvvss..',
    '.....ssvyyvv....',
    '.......vvvyv....',
    '.......vvvvy....',
    '.......kkkkkk...',
    '......kkk..kkss.',
    '.....ss.....ss..',
    '....kk......k...',
    '...tt.......ttt.',
    '................',
  ],
].map((body) => [...HEAD, ...body])

// 12x12 level icons
export const ICONS = {
  monitor: [
    '............',
    '.nnnnnnnnnn.',
    '.nddddddddn.',
    '.ndccwcccdn.',
    '.ndcwccccdn.',
    '.ndccccccdn.',
    '.ndccccccdn.',
    '.nddddddddn.',
    '.nnnnnnnnnn.',
    '.....nn.....',
    '....nddn....',
    '..nnnnnnnn..',
  ],
  saw: [
    '............',
    '............',
    '............',
    '.UUU........',
    'UuuuUwwwwwww',
    'Uu.uUlllllll',
    'UuuuUllllll.',
    '.UUU.l.l.l..',
    '............',
    '............',
    '............',
    '............',
  ],
  mail: [
    '............',
    '............',
    'nnnnnnnnnnnn',
    'nlwwwwwwwwln',
    'nwlwwwwwwlwn',
    'nwwlwwwwlwwn',
    'nwwwllllwwwn',
    'nwwwwwwwwwwn',
    'nwwwwwwwwwwn',
    'nnnnnnnnnnnn',
    '............',
    '............',
  ],
  mystery: [
    '.nnnnnnnnnn.',
    'nccccccccccn',
    'ncdccwwccdcn',
    'ncccwccwcccn',
    'nccccccwcccn',
    'ncccccwccccn',
    'nccccwcccccn',
    'nccccccccccn',
    'nccccwcccccn',
    'ncdccccccdcn',
    'nddddddddddn',
    '.nnnnnnnnnn.',
  ],
} satisfies Record<string, Art>
export type IconName = keyof typeof ICONS

const MOON = ['..www..', '.wwwwM.', 'wwwwwMM', 'wwMwwwM', 'wwwwwMM', '.wwwMM.', '..wMM..']
const CLOUD = ['....qqqq......', '..qqqqqqqq.qq.', '.qqqqqqqqqqqqq', 'qqqqqqqqqqqqqq', '.QQQQQQQQQQQQ.']
// Gqeberha's lighthouse, on the far hills
const LIGHTHOUSE = ['..c..', '.ncn.', 'nnnnn', '.MMM.', '.rrr.', '.MMM.', '.MMM.', '.rrr.', '.MMM.', 'MMMMM', 'MMMMM', 'rrrrr', 'MMMMM', 'MMMMM']
const BUSH = ['..ZZZ...', '.ZZZZZZ.', 'ZZZZZZZZ', 'zzzzzzzz']

// The scene is 400x72 scene pixels; CSS makes the game 72 x var(--b) tall, so one scene pixel is one --b
const W = 400
const H = 72
const GROUND = 14 // rows from the path line down; CSS --line matches

const hill = (x: number, base: number, amp: number, phase: number) =>
  Math.round(base - amp * (0.5 + 0.25 * Math.sin((x + phase) / 23) + 0.25 * Math.sin((x + phase) / 9)))

// Stepped silhouette, 3 scene pixels per step
function hills(base: number, amp: number, phase: number) {
  let d = `M0 ${H}`
  for (let x = 0; x < W; x += 3) d += `V${hill(x, base, amp, phase)}H${x + 3}`
  return `${d}V${H}Z`
}

// Fixed-seed scatter so the stars land in the same places on every load
let seed = 11
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
// Below the HUD line, so none land in its text
const STARS = Array.from({ length: 40 }, () => ({ x: Math.floor(rand() * W), y: Math.floor(14 + rand() * 30), twinkle: rand() < 0.3 }))

// Between the 2nd and 3rd signs, where it's visible at every width
const LIGHTHOUSE_X = 204
const lighthouseY = Math.max(hill(LIGHTHOUSE_X, 50, 16, 0), hill(LIGHTHOUSE_X + 4, 50, 16, 0)) - LIGHTHOUSE.length

export function Scene() {
  const line = H - GROUND
  return (
    <svg className="game-scene" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" shapeRendering="crispEdges" aria-hidden="true">
      <defs>
        <pattern id="bricks" width="12" height="6" patternUnits="userSpaceOnUse">
          <rect width="12" height="6" fill="#1f4eab" />
          <rect width="12" height="1" fill="#152f73" />
          <rect y="3" width="12" height="1" fill="#152f73" />
          <rect y="1" width="1" height="2" fill="#152f73" />
          <rect x="6" y="4" width="1" height="2" fill="#152f73" />
          <rect x="1" y="1" width="5" height="1" fill="#3f59c6" />
          <rect x="7" y="4" width="5" height="1" fill="#3f59c6" />
          <rect y="4" width="5" height="1" fill="#3f59c6" />
        </pattern>
      </defs>
      {STARS.map((s, i) => (
        <rect key={i} className={s.twinkle ? 'star twinkle' : 'star'} x={s.x} y={s.y} width="1" height="1" fill="#8fa3e8" style={{ animationDelay: `${-i * 0.37}s` }} />
      ))}
      <Sprite art={MOON} x={252} y={16} />
      <g className="cloud"><Sprite art={CLOUD} x={0} y={12} /></g>
      <g className="cloud" style={{ animationDelay: '-70s' }}><Sprite art={CLOUD} x={0} y={22} /></g>
      <path d={hills(50, 16, 0)} fill="#272b66" />
      <Sprite art={LIGHTHOUSE} x={LIGHTHOUSE_X} y={lighthouseY} />
      <path d={hills(59, 9, 140)} fill="#1c1f4f" />
      <Sprite art={BUSH} x={18} y={line - 4} />
      <Sprite art={BUSH} x={182} y={line - 4} />
      <Sprite art={BUSH} x={366} y={line - 4} />
      <rect y={line} width={W} height="1" fill="#12a2e5" />
      <rect y={line + 1} width={W} height={GROUND - 1} fill="url(#bricks)" />
    </svg>
  )
}
