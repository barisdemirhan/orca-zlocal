import { useLayoutEffect, useMemo, useRef } from 'react'
import { detectLanguage } from '../../../../shared/editor-language/editor-language-detect'
import {
  CsvViewer,
  IpynbPreview,
  MermaidViewer,
  MonacoCodeExcerpt
} from '../editor/editor-lazy-views'
import { peekReadRuntimeEnvironmentId, type AgentHubPeekContent } from './agent-hub-peek-store'
import type { AgentHubPeekDocumentKind } from './agent-hub-peek-document-budget'

type FileContent = Omit<Extract<AgentHubPeekContent, { filePath: string }>, 'kind'> & {
  kind: AgentHubPeekDocumentKind
}

export function AgentHubPeekDocument({
  file,
  content,
  cacheKey,
  worktreeId
}: {
  file: FileContent
  content: string
  cacheKey: string
  worktreeId?: string
}): React.JSX.Element {
  const lines = useMemo(
    () => (file.kind === 'text' ? content.split(/\r\n|\r|\n/) : []),
    [content, file.kind]
  )
  const textRef = useRef<HTMLDivElement>(null)
  const line =
    file.kind === 'text' && file.line != null && Number.isSafeInteger(file.line) && file.line > 0
      ? Math.min(file.line, lines.length)
      : 0
  useLayoutEffect(() => {
    if (line > 0) {
      textRef.current?.firstElementChild?.children
        .item(line - 1)
        ?.scrollIntoView({ block: 'center', inline: 'nearest' })
    }
  }, [cacheKey, line, lines])
  switch (file.kind) {
    case 'csv':
      return (
        <CsvViewer
          key={cacheKey}
          content={content}
          filePath={file.filePath}
          worktreeId={worktreeId}
          runtimeEnvironmentId={peekReadRuntimeEnvironmentId(file.readContext) ?? undefined}
          preferenceKey={cacheKey}
        />
      )
    case 'mermaid':
      return <MermaidViewer key={cacheKey} content={content} scrollCacheKey={cacheKey} />
    case 'notebook':
      return <IpynbPreview key={cacheKey} content={content} />
    case 'text':
      return (
        <div
          ref={textRef}
          className="h-full min-h-0 overflow-auto bg-editor-surface scrollbar-editor"
        >
          <MonacoCodeExcerpt
            key={cacheKey}
            lines={lines}
            firstLineNumber={1}
            highlightedStartLine={line}
            highlightedEndLine={line}
            language={detectLanguage(file.filePath)}
          />
        </div>
      )
  }
}
