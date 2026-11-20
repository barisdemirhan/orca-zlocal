import { detectLanguage } from '../../../../shared/editor-language/editor-language-detect'
import { hasBinaryFileExtension } from '../../../../shared/file-preview/binary-file-extensions'
import type { AgentHubPeekItem } from './agent-hub-peek-store'

type PeekFileKind = Extract<AgentHubPeekItem['content'], { filePath: string }>['kind'] | 'html'

const FILE_KINDS: readonly [RegExp, PeekFileKind][] = [
  [/\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/i, 'image'],
  [/\.pdf$/i, 'pdf'],
  [/\.(mp4|mov|m4v|webm|mp3|wav|m4a|aac|ogg|oga|flac|opus)$/i, 'media'],
  [/\.html?$/i, 'html'],
  [/\.(md|markdown|mdx)$/i, 'markdown']
]

export function agentHubPeekFileKind(filePath: string): PeekFileKind | null {
  const explicit = FILE_KINDS.find(([pattern]) => pattern.test(filePath))?.[1]
  if (explicit) {
    return explicit
  }
  if (hasBinaryFileExtension(filePath)) {
    return null
  }
  const language = detectLanguage(filePath)
  switch (language) {
    case 'csv':
    case 'tsv':
      return 'csv'
    case 'mermaid':
      return 'mermaid'
    case 'notebook':
      return 'notebook'
    default:
      return language !== 'plaintext' || /\.(txt|log)$/i.test(filePath) ? 'text' : null
  }
}
