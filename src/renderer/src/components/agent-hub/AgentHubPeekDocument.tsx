import { useMemo } from 'react'
import { detectLanguage } from '@/lib/language-detect'
import {
  CsvViewer,
  IpynbPreview,
  MermaidViewer,
  MonacoCodeExcerpt
} from '../editor/editor-lazy-views'
import type { AgentHubPeekContent } from './agent-hub-peek-store'
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
  switch (file.kind) {
    case 'csv':
      return (
        <CsvViewer
          key={cacheKey}
          content={content}
          filePath={file.filePath}
          worktreeId={worktreeId}
          runtimeEnvironmentId={file.readContext?.settings?.activeRuntimeEnvironmentId}
          preferenceKey={cacheKey}
        />
      )
    case 'mermaid':
      return (
        <MermaidViewer
          key={cacheKey}
          content={content}
          scrollCacheKey={cacheKey}
        />
      )
    case 'notebook':
      return <IpynbPreview key={cacheKey} content={content} />
    case 'text':
      return (
        <div className="h-full min-h-0 overflow-auto bg-editor-surface scrollbar-editor">
          <MonacoCodeExcerpt
            key={cacheKey}
            lines={lines}
            firstLineNumber={1}
            highlightedStartLine={0}
            highlightedEndLine={0}
            language={detectLanguage(file.filePath)}
          />
        </div>
      )
  }
}
