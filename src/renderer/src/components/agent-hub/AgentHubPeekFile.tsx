import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { userNamedFileAccess } from '@/lib/local-file-access'
import { readRuntimeFileContent } from '@/runtime/runtime-file-read-client'
import type {
  RuntimeFileReadArgs,
  RuntimeReadableFileContent
} from '@/runtime/runtime-file-client-types'
import { ImageViewer, MediaViewer } from '../editor/editor-lazy-views'
import { buildImageDataUri } from '../../../../shared/image-data-uri'
import type { AgentHubPeekContent } from './agent-hub-peek-store'

function runtimeReadTargetKey(target: RuntimeFileReadArgs['target'] | undefined): string {
  return target?.kind === 'environment' ? target.environmentId : ''
}

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

/** An image, PDF or video through the editor's own viewers, read the way the editor reads it. */
export function AgentHubPeekFile({
  content,
  onContentSize,
  onUnavailable
}: {
  content: PeekFileContent
  /** The image's or video's own size, so Peek can shrink to it; null for a PDF or a failure. */
  onContentSize: (size: ContentSize | null) => void
  onUnavailable: () => void
}): React.JSX.Element {
  const [load, setLoad] = useState<{ key: string; state: LoadState }>({
    key: '',
    state: { status: 'loading' }
  })
  const { filePath, connectionId } = content
  const key = `${runtimeReadTargetKey(content.readContext?.target)}\u0000${content.readContext?.worktreeId ?? ''}\u0000${connectionId ?? ''}\u0000${filePath}`
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
  const onUnavailableRef = useRef(onUnavailable)
  const onContentSizeRef = useRef(onContentSize)
  useLayoutEffect(() => {
    onContentSizeRef.current = onContentSize
    onUnavailableRef.current = onUnavailable
  })
  useEffect(() => {
    if (state.status === 'failed') {
      onContentSizeRef.current(null)
      onUnavailableRef.current()
    } else if (readyFile && (!readyFile.isBinary || (!readyFile.mediaUrl && !readyFile.isImage))) {
      onUnavailableRef.current()
    }
    return readyFile
      ? measureNaturalSize(readyFile, (size) => onContentSizeRef.current(size))
      : undefined
  }, [readyFile, state.status])
  const loading = (
    <Centered>
      <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
    </Centered>
  )
  if (state.status === 'loading') {
    return loading
  }
  const file = state.status === 'ready' ? state.file : null
  if (!file || !file.isBinary || (!file.mediaUrl && !file.isImage)) {
    return (
      <Centered>
        {translate('agentHub.peek.unreadable', 'This file could not be shown here.')}
      </Centered>
    )
  }
  return (
    <Suspense fallback={loading}>
      {file.mediaUrl ? (
        <MediaViewer
          key={file.mediaUrl}
          src={file.mediaUrl}
          mimeType={file.mimeType ?? ''}
          filePath={content.filePath}
          canOpenLocally={!connectionId && content.readContext?.target.kind !== 'environment'}
        />
      ) : (
        <ImageViewer content={file.content} filePath={content.filePath} mimeType={file.mimeType} />
      )}
    </Suspense>
  )
}
