import type { ReactNode } from 'react'

const FILL = 'linear-gradient(currentColor,currentColor)'
const part = (position: string, size: string): string => `${FILL} ${position}/${size} no-repeat`
const TL = part('left top', '50% 50%')
const TR = part('right top', '50% 50%')
const BL = part('left bottom', '50% 50%')
const BR = part('right bottom', '50% 50%')
const lower = (eighths: number): string => part('bottom', `100% ${eighths * 12.5}%`)
const left = (eighths: number): string => part('left', `${eighths * 12.5}% 100%`)
const shade = (percent: number): string =>
  `linear-gradient(color-mix(in srgb, currentColor ${percent}%, transparent), color-mix(in srgb, currentColor ${percent}%, transparent))`

// Terminals draw these to fill the cell edge to edge; a font's glyphs leave gaps between rows.
const BLOCK_FILLS: Record<string, string> = {
  '▀': part('top', '100% 50%'),
  '▁': lower(1),
  '▂': lower(2),
  '▃': lower(3),
  '▄': lower(4),
  '▅': lower(5),
  '▆': lower(6),
  '▇': lower(7),
  '█': FILL,
  '▉': left(7),
  '▊': left(6),
  '▋': left(5),
  '▌': left(4),
  '▍': left(3),
  '▎': left(2),
  '▏': left(1),
  '▐': part('right', '50% 100%'),
  '░': shade(25),
  '▒': shade(50),
  '▓': shade(75),
  '▔': part('top', '100% 12.5%'),
  '▕': part('right', '12.5% 100%'),
  '▖': BL,
  '▗': BR,
  '▘': TL,
  '▙': [TL, BL, BR].join(','),
  '▚': [TL, BR].join(','),
  '▛': [TL, TR, BL].join(','),
  '▜': [TL, TR, BR].join(','),
  '▝': TR,
  '▞': [TR, BL].join(','),
  '▟': [TR, BL, BR].join(','),
  // Box-drawing lines often come from a fallback font a hair wider than the cell, so they are painted too.
  '─': part('center', '100% 1px'),
  '━': part('center', '100% 2px'),
  '│': part('center', '1px 100%'),
  '┃': part('center', '2px 100%')
}

const BLOCK_RUN = /[─━│┃▀-▟]/
// Fills that span the cell's full width tile seamlessly, so a run of one is drawn as a single span.
const FULL_WIDTH = /[─━▀▁-█░-▔]/

function blockSpan(key: number, fill: string, cells: number): ReactNode {
  return (
    <span
      key={key}
      aria-hidden
      className="inline-block h-(--plugin-row) align-top"
      style={{ background: fill, width: `calc(var(--plugin-cell, 1ch) * ${cells})` }}
    />
  )
}

/** Text a mod drew, with block elements and lines painted as full cells the way a terminal draws them. */
export function withBlockGlyphs(text: string): ReactNode {
  if (!BLOCK_RUN.test(text)) {
    return text
  }
  const parts: ReactNode[] = []
  const chars = [...text]
  let plain = ''
  for (let index = 0; index < chars.length; index++) {
    const char = chars[index]
    const fill = BLOCK_FILLS[char]
    if (!fill) {
      plain += char
      continue
    }
    if (plain) {
      parts.push(plain)
      plain = ''
    }
    let cells = 1
    while (FULL_WIDTH.test(char) && chars[index + cells] === char) {
      cells++
    }
    parts.push(blockSpan(parts.length, fill, cells))
    index += cells - 1
  }
  if (plain) {
    parts.push(plain)
  }
  return parts
}
