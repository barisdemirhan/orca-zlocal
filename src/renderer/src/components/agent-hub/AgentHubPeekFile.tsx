import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { userNamedFileAccess } from '@/lib/files/access/local-file-access'
import { readRuntimeFileContent } from '@/runtime/files/reads/runtime-file-read-client'
import type { RuntimeReadableFileContent } from '@/runtime/files/runtime-file-client-types'
import { ImageViewer, MarkdownPreview, MediaViewer } from '../editor/editor-lazy-views'
import { absolutePathToFileUri } from '../editor/markdown/link-routing/markdown-internal-links'
import { buildImageDataUri } from '../../../../shared/file-preview/image-data-uri'
import { peekReadRuntimeEnvironmentId, type AgentHubPeekContent } from './agent-hub-peek-store'
import { AgentHubPeekDocument } from './AgentHubPeekDocument'
import {
  canRenderAgentHubPeekDocument,
  isAgentHubPeekDocumentKind
} from './agent-hub-peek-document-budget'

type PeekFileContent = Extract<AgentHubPeekContent, { filePath: string }>

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; file: RuntimeReadableFileContent }
  | { status: 'failed' }

function Centered({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
      {children}
    </div>
  )
}

type ContentSize = { width: number; height: number }

/** An image's or video's own pixel size; null where the viewer should simply take the room. */
function measureNaturalSize(
  file: RuntimeReadableFileContent,
  report: (size: ContentSize | null) => void
): () => void {
  if (file.mediaUrl) {
    if (!file.mimeType?.startsWith('video/')) {
      // Audio needs only the player's strip.
      report({ width: 0, height: 0 })
      return () => undefined
    }
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.onloadedmetadata = () =>
      report(video.videoWidth ? { width: video.videoWidth, height: video.videoHeight } : null)
    video.onerror = () => report(null)
    video.src = file.mediaUrl
    return () => {
      video.onloadedmetadata = null
      video.removeAttribute('src')
      video.load()
    }
  }
  const dataUri = buildImageDataUri(file.mimeType, file.content)
  if (!dataUri) {
    report(null)
    return () => undefined
  }
  const image = new Image()
  image.onload = () =>
    report(image.naturalWidth ? { width: image.naturalWidth, height: image.naturalHeight } : null)
  image.onerror = () => report(null)
  image.src = dataUri
  return () => {
    image.onload = null
  }
}

/** Files through the editor's own viewers and runtime reader. */
export function AgentHubPeekFile({
  content,
  worktreeId = content.readContext?.worktreeId,
  onOpenLink,
  onContentSize,
  onUnavailable
}: {
  content: PeekFileContent
  worktreeId?: string
  onOpenLink?: (href: string) => boolean
  /** Image/video size for shrinking Peek; null for documents or a failure. */
  onContentSize: (size: ContentSize | null) => void
  onUnavailable: () => void
}): React.JSX.Element {
  const [load, setLoad] = useState<{ key: string; state: LoadState }>({
    key: '',
    state: { status: 'loading' }
  })
  const { filePath, connectionId } = content
  const key = `${peekReadRuntimeEnvironmentId(content.readContext) ?? ''}\u0000${content.readContext?.worktreeId ?? ''}\u0000${connectionId ?? ''}\u0000${filePath}`
  useEffect(() => {
    let live = true
    void readRuntimeFileContent(
      content.readContext ?? {
        target: { kind: 'local' },
        filePath,
        ...(connectionId ? { connectionId } : { access: userNamedFileAccess() })
      }
    )
      .then((file) => live && setLoad({ key, state: { status: 'ready', file } }))
      .catch(() => live && setLoad({ key, state: { status: 'failed' } }))
    return () => {
      live = false
    }
  }, [key, filePath, connectionId, content.readContext])

  const state: LoadState = load.key === key ? load.state : { status: 'loading' }
  const readyFile = state.status === 'ready' ? state.file : null
  const documentKind = isAgentHubPeekDocumentKind(content.kind) ? content.kind : null
  const documentContent = readyFile?.content
  const tooLarge = useMemo(
    () =>
      documentContent !== undefined &&
      documentKind !== null &&
      !canRenderAgentHubPeekDocument(documentKind, documentContent),
    [documentContent, documentKind]
  )
  const unreadable =
    readyFile !== null &&
    (content.kind === 'markdown' || documentKind !== null
      ? readyFile.isBinary || tooLarge
      : !readyFile.isBinary || (!readyFile.mediaUrl && !readyFile.isImage))
  const onUnavailableRef = useRef(onUnavailable)
  const onContentSizeRef = useRef(onContentSize)
  useLayoutEffect(() => {
    onContentSizeRef.current = onContentSize
    onUnavailableRef.current = onUnavailable
  })
  useEffect(() => {
    if (state.status === 'failed' || unreadable) {
      onContentSizeRef.current(null)
      onUnavailableRef.current()
      return undefined
    }
    if (content.kind === 'markdown' || documentKind !== null) {
      onContentSizeRef.current(null)
      return undefined
    }
    return readyFile
      ? measureNaturalSize(readyFile, (size) => onContentSizeRef.current(size))
      : undefined
  }, [readyFile, state.status, unreadable, content.kind, documentKind])
  const loading = (
    <Centered>
      <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
    </Centered>
  )
  if (state.status === 'loading') {
    return loading
  }
  const file = state.status === 'ready' ? state.file : null
  if (!file || unreadable) {
    return (
      <Centered>
        {translate('agentHub.peek.unreadable', 'This file could not be shown here.')}
      </Centered>
    )
  }
  return (
    <Suspense fallback={loading}>
      {content.kind === 'markdown' ? (
        <div
          className="mx-auto h-full min-h-0 w-full max-w-prose"
          // WHY: ordinary Markdown links bypass onOpenDocument in the shared editor viewer.
          onClickCapture={(event) => {
            const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
            const href = anchor?.getAttribute('href')
            if (href && onOpenLink?.(href)) {
              event.preventDefault()
              event.stopPropagation()
            }
          }}
        >
          <MarkdownPreview
            key={key}
            content={file.content}
            filePath={filePath}
            sourceWorktreeId={worktreeId}
            sourceRuntimeEnvironmentId={peekReadRuntimeEnvironmentId(content.readContext)}
            scrollCacheKey={`agent-hub-peek:${key}`}
            initialAnchor={content.initialAnchor}
            showTableOfContents={false}
            markdownAnnotationsEnabled={false}
            onOpenDocument={(document, options) => {
              const uri = absolutePathToFileUri(document.filePath)
              onOpenLink?.(options?.anchor ? `${uri}#${options.anchor}` : uri)
            }}
          />
        </div>
      ) : documentKind !== null ? (
        <div
          className="h-full min-h-0"
          onClickCapture={(event) => {
            const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
            const href = anchor?.getAttribute('href')
            if (href && onOpenLink?.(href)) {
              event.preventDefault()
              event.stopPropagation()
            }
          }}
        >
          <AgentHubPeekDocument
            file={{ ...content, kind: documentKind }}
            content={file.content}
            cacheKey={`agent-hub-peek:${key}`}
            worktreeId={worktreeId}
          />
        </div>
      ) : file.mediaUrl ? (
        <MediaViewer
          key={file.mediaUrl}
          src={file.mediaUrl}
          mimeType={file.mimeType ?? ''}
          filePath={content.filePath}
          canOpenLocally={!connectionId && !peekReadRuntimeEnvironmentId(content.readContext)}
        />
      ) : (
        <ImageViewer content={file.content} filePath={content.filePath} mimeType={file.mimeType} />
      )}
    </Suspense>
  )
}
