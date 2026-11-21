import type { CSSProperties } from 'react'

/** Mods lay out in terminal cells: one glyph of this font across (`--plugin-cell`, measured) and one line down. */
export const PLUGIN_CELL_FONT_CLASS = 'font-mono text-chat-code leading-[var(--plugin-row)]'
export const PLUGIN_ROW_REM = 1.125

/** Inline style that fixes the row height every cell length below is measured in. */
export const PLUGIN_CELL_ROOT_STYLE = { '--plugin-row': `${PLUGIN_ROW_REM}rem` } as CSSProperties

// `ch` can resolve narrower than the glyphs drawn, so the frame sets the cell it measured.
export function pluginCellsX(cells: number): string {
  return `calc(${cells} * var(--plugin-cell, 1ch))`
}

export function pluginCellsY(rows: number): string {
  return `calc(${rows} * var(--plugin-row))`
}

/** The terminal docks a pane beside the transcript from this many columns. */
export const PLUGIN_DOCK_MIN_COLUMNS = 110
/** A docked pane, its rule included, takes at most this share of the columns. */
export const PLUGIN_DOCK_MAX_SHARE = 0.45
/** Deck and most mods ask for this width; used when a pane names none. */
export const PLUGIN_PANE_DEFAULT_COLUMNS = 52
/** The band leaves the terminal's five end cells free, where it draws `[-]`. */
export const PLUGIN_BAND_RESERVED_COLUMNS = 5
/** The inline frame's rule and gutter: half a cell of rule and one cell of gutter each side. */
export const PLUGIN_INLINE_FRAME_COLUMNS = 3
