import { Suspense, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { userNamedFileAccess } from '@/lib/local-file-access'
import { readRuntimeFileContent } from '@/runtime/runtime-file-client'
import type { RuntimeReadableFileContent } from '@/runtime/runtime-file-client-types'
import { ImageViewer, MediaViewer } from '../editor/editor-lazy-views'
import type { AgentHubPeekContent } from './agent-hub-peek-store'

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

/** An image, PDF or video through the editor's own viewers, read the way the editor reads it. */
export function AgentHubPeekFile({ content }: { content: PeekFileContent }): React.JSX.Element {
  const [load, setLoad] = useState<{ key: string; state: LoadState }>({
    key: '',
    state: { status: 'loading' }
  })
  const key = content.filePath
  useEffect(() => {
    let live = true
    void readRuntimeFileContent({
      // Why: Peek only takes this machine's files, so the window's remote runtime never reads it.
      settings: { activeRuntimeEnvironmentId: null },
      filePath: key,
      // Why: an agent's artifact usually sits outside the workspace, where only a path the user
      // picked themselves may be read.
      access: userNamedFileAccess()
    })
      .then((file) => live && setLoad({ key, state: { status: 'ready', file } }))
      .catch(() => live && setLoad({ key, state: { status: 'failed' } }))
    return () => {
      live = false
    }
  }, [key])

  const state: LoadState = load.key === key ? load.state : { status: 'loading' }
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
          canOpenLocally
        />
      ) : (
        <ImageViewer content={file.content} filePath={content.filePath} mimeType={file.mimeType} />
      )}
    </Suspense>
  )
}
