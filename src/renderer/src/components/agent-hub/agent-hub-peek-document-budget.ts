import { parseIpynb } from '../editor/notebook/document/ipynb-parse'
import {
  IPYNB_CODE_CELL_PREVIEW_LINE_MAX_CODE_UNITS,
  IPYNB_CODE_CELL_PREVIEW_MAX_LINES,
  IPYNB_CODE_CELL_PREVIEW_SCAN_CODE_UNITS
} from '../editor/notebook/cells/ipynb-code-cell-lines'
import { MAX_TOKENIZATION_LINE_LENGTH } from '@/lib/monaco-languages/monarch-embed-entry-budget'
import type { AgentHubPeekContent } from './agent-hub-peek-store'

export type AgentHubPeekDocumentKind = 'csv' | 'mermaid' | 'notebook' | 'text'

export function isAgentHubPeekDocumentKind(
  kind: AgentHubPeekContent['kind']
): kind is AgentHubPeekDocumentKind {
  return kind === 'csv' || kind === 'mermaid' || kind === 'notebook' || kind === 'text'
}

/** Full-file code colorization and notebook cells are not virtualized like the editor. */
export function canRenderAgentHubPeekDocument(
  kind: AgentHubPeekDocumentKind,
  content: string
): boolean {
  if (content.length > 512 * 1024) {
    return false
  }
  if (kind === 'text') {
    const lines = content.split(/\r\n|\r|\n/)
    return lines.every((line) => line.length <= MAX_TOKENIZATION_LINE_LENGTH)
  }
  if (kind === 'notebook') {
    try {
      const notebook = parseIpynb(content)
      return (
        notebook.cells.length <= 250 &&
        notebook.cells.every((cell) => {
          if (cell.kind === 'markdown') {
            return true
          }
          const lines = cell.source.split(/\r\n|\r|\n/)
          return (
            cell.source.length <= IPYNB_CODE_CELL_PREVIEW_SCAN_CODE_UNITS &&
            lines.length <= IPYNB_CODE_CELL_PREVIEW_MAX_LINES &&
            lines.every((line) => line.length <= IPYNB_CODE_CELL_PREVIEW_LINE_MAX_CODE_UNITS)
          )
        })
      )
    } catch {
      // Malformed notebooks use the viewer's existing inline error presentation.
      return true
    }
  }
  return true
}
