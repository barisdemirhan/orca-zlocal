import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ExternalLink, PanelTop, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { HubChip } from './AgentHubInlineLabels'
import { AgentHubActionTooltip } from './AgentHubShortcut'
import { useAgentHubTargetTitle } from './AgentHubMirrorTitle'
import { AgentHubPeekBrowser, closeLeftoverAgentHubPeekPages } from './AgentHubPeekBrowser'
import { AgentHubPeekFile } from './AgentHubPeekFile'
import { agentHubWorkArea } from './agent-hub-floating-arrangement'
import { activeAgentHubMirrorTab, agentHubMirrorWindows } from './agent-hub-mirror-membership'
import {
  focusAgentHubMirror,
  restoreAgentHubMirror,
  useAgentHubMirrors
} from './agent-hub-mirror-store'
import {
  closeAgentHubPeek,
  goBackAgentHubPeek,
  openAgentHubPeek,
  readAgentHubPeek,
  registerAgentHubPeekHost,
  useAgentHubPeek,
  type AgentHubPeekItem
} from './agent-hub-peek-store'
import { agentHubPeekUrlItem } from './agent-hub-peek-routing'
import { openRoutedHttpLink } from '@/lib/http-link-destinations'
import { useViewportSize } from './use-viewport-size'

// Why an inset: the work area's edges stay visible, so Peek reads as a window over the app.
const PEEK_INSET = 16

function kindLabel(item: AgentHubPeekItem): string {
  switch (item.content.kind) {
    case 'web':
      return translate('agentHub.peek.kindWeb', 'Web')
    case 'image':
      return translate('agentHub.peek.kindImage', 'Image')
    case 'pdf':
      return translate('agentHub.peek.kindPdf', 'PDF')
    case 'media':
      return translate('agentHub.peek.kindMedia', 'Media')
  }
}

/** The mirror the link was clicked in; a click brings it to the front. */
function SourceChip({ mirrorKey }: { mirrorKey: string }): React.JSX.Element | null {
  const mirrors = useAgentHubMirrors()
  const window = agentHubMirrorWindows(mirrors).find((entry) => entry.id === mirrorKey)
  if (!window) {
    return null
  }
  return <SourceButton mirrorKey={mirrorKey} target={activeAgentHubMirrorTab(window).target} />
}

function SourceButton({
  mirrorKey,
  target
}: {
  mirrorKey: string
  target: Parameters<typeof useAgentHubTargetTitle>[0]
}): React.JSX.Element {
  const title = useAgentHubTargetTitle(target)
  const label = translate('agentHub.peek.source', 'From {{value0}}', { value0: title })
  return (
    <AgentHubActionTooltip
      label={translate('agentHub.peek.showSource', 'Close Peek and go back to this mirror')}
    >
      <Button
        type="button"
        variant="ghost"
        size="xs"
        aria-label={label}
        onClick={() => {
          closeAgentHubPeek()
          restoreAgentHubMirror(mirrorKey)
          focusAgentHubMirror(mirrorKey)
        }}
      >
        <span className="max-w-40 truncate">{title}</span>
      </Button>
    </AgentHubActionTooltip>
  )
}

/**
 * A large, passing look at a page or file an agent pointed to: no minimizing, no restoring, one
 * at a time. It locks nothing, so the hub stays usable over it; Esc or ✕ closes it.
 */
export function AgentHubPeek(): React.JSX.Element | null {
  const peek = useAgentHubPeek()
  const rootRef = useRef<HTMLDivElement>(null)
  // Recomputed on resize: the work area follows the window and the sidebars.
  useViewportSize()
  const item = peek ? peek.history[peek.index] : null
  const open = item !== null
  useEffect(() => {
    // Why only when closed: an open Peek's page is live, and this host can remount under it.
    if (!readAgentHubPeek()) {
      closeLeftoverAgentHubPeekPages()
    }
    return registerAgentHubPeekHost()
  }, [])
  useEffect(() => {
    if (!open) {
      return undefined
    }
    const opener = document.activeElement
    // Why: Esc must close Peek, not reach the agent in the terminal that was clicked.
    rootRef.current?.focus({ preventScroll: true })
    return () => {
      // Typing goes back where it was, usually the terminal the link was clicked in.
      if (opener instanceof HTMLElement && opener.isConnected) {
        opener.focus({ preventScroll: true })
      }
    }
  }, [open])
  if (!peek || !item) {
    return null
  }
  const area = agentHubWorkArea()
  const web = item.content.kind === 'web'
  const openInLabel = web
    ? translate('agentHub.peek.openInTab', 'Open in tab')
    : translate('agentHub.peek.openInEditor', 'Open in editor')
  const openOutLabel = web
    ? translate('agentHub.peek.openInBrowser', 'Open in browser')
    : translate('agentHub.peek.openWithApp', 'Open with default app')
  const leave = (action: () => void): void => {
    closeAgentHubPeek()
    action()
  }
  return createPortal(
    <div
      ref={rootRef}
      tabIndex={-1}
      role="dialog"
      aria-modal={false}
      aria-label={item.title}
      data-agent-hub-peek={item.content.kind}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !event.defaultPrevented) {
          event.preventDefault()
          event.stopPropagation()
          closeAgentHubPeek()
        }
      }}
      // Why z-[46] and portaled last: over the mirrors, under the tray and alerts; the hub and
      // its Inbox card (a dialog) stay usable over it.
      className="fixed z-[46] flex flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-floating outline-none"
      style={{
        left: area.left + PEEK_INSET,
        top: area.top + PEEK_INSET,
        width: Math.max(320, area.width - PEEK_INSET * 2),
        height: Math.max(240, area.height - PEEK_INSET * 2)
      }}
    >
      <header className="flex h-10.5 shrink-0 items-center gap-2 border-b border-border pr-1.5 pl-2">
        {peek.index > 0 ? (
          <AgentHubActionTooltip label={translate('agentHub.peek.back', 'Previous peek')}>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={translate('agentHub.peek.back', 'Previous peek')}
              onClick={goBackAgentHubPeek}
            >
              <ArrowLeft />
            </Button>
          </AgentHubActionTooltip>
        ) : null}
        <HubChip>{kindLabel(item)}</HubChip>
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-[13px] font-semibold">{item.title}</span>
          <span className="truncate font-mono text-[11px] text-muted-foreground">
            {item.location}
          </span>
        </div>
        {item.mirrorKey ? <SourceChip mirrorKey={item.mirrorKey} /> : null}
        <Button type="button" variant="ghost" size="xs" onClick={() => leave(item.openInWorkspace)}>
          <PanelTop aria-hidden className="size-3.5" />
          {openInLabel}
        </Button>
        {item.openExternally ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => item.openExternally && leave(item.openExternally)}
          >
            <ExternalLink aria-hidden className="size-3.5" />
            {openOutLabel}
          </Button>
        ) : null}
        <AgentHubActionTooltip label={translate('agentHub.peek.close', 'Close (esc)')}>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={translate('agentHub.peek.close', 'Close (esc)')}
            onClick={closeAgentHubPeek}
          >
            <X />
          </Button>
        </AgentHubActionTooltip>
      </header>
      <div className="relative flex min-h-0 flex-1 flex-col bg-background">
        {item.content.kind === 'web' ? (
          <AgentHubPeekBrowser
            url={item.content.url}
            hostId={item.content.hostId}
            onOpenPage={(url) => {
              const next = agentHubPeekUrlItem(url, {
                worktreeId: item.worktreeId,
                onPairedRuntime: false,
                event: undefined,
                openInWorkspace: () =>
                  openRoutedHttpLink(url, { worktreeId: item.worktreeId, modifierHeld: false }),
                openExternally: () =>
                  openRoutedHttpLink(url, {
                    worktreeId: item.worktreeId,
                    modifierHeld: false,
                    forceDestination: 'system'
                  })
              })
              if (next) {
                openAgentHubPeek({ ...next, mirrorKey: item.mirrorKey })
              }
            }}
          />
        ) : (
          <AgentHubPeekFile content={item.content} />
        )}
      </div>
    </div>,
    document.body
  )
}
