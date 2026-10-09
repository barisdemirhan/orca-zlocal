import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { translate } from '@/i18n/i18n'
import { useAgentHubDictationSession } from './agent-hub-dictation-origin'
import { useDictationShownInMirror } from './agent-hub-mirror-dictation-display'
import type { AgentHubDictationPane } from './agent-hub-mirror-mic-state'

function findPaneContainer(pane: AgentHubDictationPane): HTMLElement | null {
  const leaf = pane.leafId ? `.pane[data-leaf-id="${CSS.escape(pane.leafId)}"]` : '.pane'
  return document.querySelector<HTMLElement>(
    `[data-terminal-tab-id="${CSS.escape(pane.tabId)}"] ${leaf}`
  )
}

/**
 * "Dictating here" on the workspace pane a dictation went into, so the words' destination is in
 * view. A mirror showing that pane has its own pill, and this one stands down.
 */
export function AgentHubDictationPaneTag(): React.JSX.Element | null {
  const session = useAgentHubDictationSession()
  const shownInMirror = useDictationShownInMirror()
  const pane = session?.pane ?? null
  const [container, setContainer] = useState<HTMLElement | null>(null)
  useLayoutEffect(() => {
    setContainer(pane ? findPaneContainer(pane) : null)
  }, [pane])
  if (!container || shownInMirror) {
    return null
  }
  return createPortal(
    <span
      data-agent-hub-dictation-pane-tag
      className="pointer-events-none absolute right-3 bottom-3 z-30 flex items-center gap-1.5 rounded-full border border-border bg-popover/95 px-2.5 py-1 text-xs text-popover-foreground shadow-floating backdrop-blur"
    >
      <span
        aria-hidden
        className="size-1.5 rounded-full bg-[var(--terminal-pane-locate)] animate-pulse motion-reduce:animate-none"
      />
      {translate('agentHub.dictation.here', 'Dictating here')}
    </span>,
    container
  )
}
