import type { CSSProperties } from 'react'

/** Mods lay out in terminal cells: one cell is 1ch of this font across and one line down. */
export const PLUGIN_CELL_FONT_CLASS = 'font-mono text-chat-code leading-[var(--plugin-row)]'
export const PLUGIN_ROW_REM = 1.125

/** Inline style that fixes the row height every cell length below is measured in. */
export const PLUGIN_CELL_ROOT_STYLE = { '--plugin-row': `${PLUGIN_ROW_REM}rem` } as CSSProperties

export function pluginCellsX(cells: number): string {
  return `${cells}ch`
}

export function pluginCellsY(rows: number): string {
  return `calc(${rows} * var(--plugin-row))`
}

/** The terminal docks a pane beside the transcript from this many columns. */
export const PLUGIN_DOCK_MIN_COLUMNS = 110
/** Deck and most mods ask for this width; used when a pane names none. */
export const PLUGIN_PANE_DEFAULT_COLUMNS = 52
/** The band leaves the terminal's five end cells free, where it draws `[-]`. */
export const PLUGIN_BAND_RESERVED_COLUMNS = 5
