/** Rows a pane's body gets, as the terminal seats it: docked it runs the transcript's height below its × row. */
export function dockedPluginPaneRows(rows: number): number {
  return Math.max(4, rows - 1)
}

/** Inline, the framed box grows with what the pane draws up to two fifths of the rows, less its rules. */
export function inlinePluginPaneRows(rows: number): number {
  return Math.max(4, Math.round(rows * 0.4) - 5)
}
