import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, Expand, ExternalLink, Minus, PanelTop, Shrink, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { HubChip } from './AgentHubInlineLabels'
import { AgentHubActionTooltip } from './AgentHubShortcut'
import { useAgentHubTargetTitle } from './AgentHubMirrorTitle'
import { AgentHubPeekBrowser, closeLeftoverAgentHubPeekPages } from './AgentHubPeekBrowser'
import { AgentHubPeekFile } from './AgentHubPeekFile'
import {
  agentHubWorkArea,
  rearrangeAgentHubMirrorsByDefault
} from './agent-hub-floating-arrangement'
import { agentHubPeekGeometry } from './agent-hub-peek-geometry'
import {
  shownAgentHubMirrorTarget,
  activeAgentHubMirrorTab,
  agentHubMirrorWindows
} from './agent-hub-mirror-membership'
import {
  focusAgentHubMirror,
  readAgentHubMirrors,
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
import { fallbackAgentHubPeek } from './agent-hub-peek-routing'
import { agentHubPeekPageItem } from './agent-hub-peek-page-navigation'
import { openAgentHubPeekMarkdownLink } from './agent-hub-peek-markdown-links'
import { useViewportSize } from './use-viewport-size'
import { useAppStore } from '@/store'
import { STATUS_BAR_RESERVE_HEIGHT } from '../../app-shell/chrome/workspace-chrome-metrics'

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
    case 'markdown':
      return translate('agentHub.peek.kindMarkdown', 'Markdown')
    case 'csv':
      return translate('agentHub.peek.kindCsv', 'Table')
    case 'mermaid':
      return translate('agentHub.peek.kindMermaid', 'Diagram')
    case 'notebook':
      return translate('agentHub.peek.kindNotebook', 'Notebook')
    case 'text':
      return translate('agentHub.peek.kindText', 'Code / text')
  }
}

/** The mirror the link was clicked in; a click brings it to the front. */
function SourceChip({ mirrorKey }: { mirrorKey: string }): React.JSX.Element | null {
  const mirrors = useAgentHubMirrors()
  const window = agentHubMirrorWindows(mirrors).find((entry) => entry.id === mirrorKey)
  if (!window) {
    return null
  }
  return (
    <SourceButton
      mirrorKey={mirrorKey}
      target={shownAgentHubMirrorTarget(activeAgentHubMirrorTab(window))}
    />
  )
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
        className="text-muted-foreground hover:text-foreground"
        aria-label={label}
        onClick={() => {
          closeAgentHubPeek()
          const parked = readAgentHubMirrors().chips.some((chip) => chip.window.id === mirrorKey)
          restoreAgentHubMirror(mirrorKey)
          focusAgentHubMirror(mirrorKey)
          if (parked) {
            rearrangeAgentHubMirrorsByDefault()
          }
        }}
      >
        {/* Why the minimize glyph: Peek folds away and the mirror comes back. */}
        <Minus aria-hidden className="size-3.5" />
        <span className="max-w-40 truncate">{title}</span>
      </Button>
    </AgentHubActionTooltip>
  )
}

/**
 * A large, passing look at a page or file an agent pointed to: no minimizing, no restoring, one
 * at a time. Normal and focused mirrors sit behind its shade; a click there, Esc or ✕ closes it.
 */
export function AgentHubPeek(): React.JSX.Element | null {
  const peek = useAgentHubPeek()
  const rootRef = useRef<HTMLDivElement>(null)
  // Recomputed on resize: the work area follows the window and the sidebars.
  useViewportSize()
  // The status bar stays lit under the shade: the dock grows out of it.
  const statusBarHeight = useAppStore((s) => (s.statusBarVisible ? STATUS_BAR_RESERVE_HEIGHT : 0))
  const item = peek ? peek.history[peek.index] : null
  const onUnavailable = useCallback(() => {
    const current = readAgentHubPeek()
    if (item && current?.history[current.index] === item) {
      fallbackAgentHubPeek(item)
    }
  }, [item])
  const open = item !== null
  const [fullScreen, setFullScreen] = useState(false)
  const [measured, setMeasured] = useState<{
    location: string
    size: { width: number; height: number } | null
  } | null>(null)
  if (!open && fullScreen) {
    setFullScreen(false)
  }
  useEffect(() => {
    // Why only when closed: an open Peek's page is live, and this host can remount under it.
    if (!readAgentHubPeek()) {
      closeLeftoverAgentHubPeekPages()
    }
    return registerAgentHubPeekHost()
  }, [])
  useEffect(() => {
    if (!open || item?.preserveKeyboardFocus) {
      return undefined
    }
    const opener = document.activeElement
    const root = rootRef.current
    // Why: Esc must close Peek, not reach the agent in the terminal that was clicked.
    rootRef.current?.focus({ preventScroll: true })
    return () => {
      // Typing goes back where it was, usually the terminal the link was clicked in.
      if (
        opener instanceof HTMLElement &&
        opener.isConnected &&
        (root?.contains(document.activeElement) || document.activeElement === document.body)
      ) {
        opener.focus({ preventScroll: true })
      }
    }
  }, [open, item?.preserveKeyboardFocus])
  if (!peek || !item) {
    return null
  }
  const web = item.content.kind === 'web'
  // Documents take the room; images and video shrink to their own size.
  const contentSize =
    web || !['image', 'media'].includes(item.content.kind)
      ? null
      : measured?.location === item.location
        ? measured.size
        : { width: 0, height: 0 }
  const box = agentHubPeekGeometry(agentHubWorkArea(), contentSize, fullScreen)
  const fullScreenLabel = fullScreen
    ? translate('agentHub.peek.exitFullScreen', 'Exit full screen')
    : translate('agentHub.peek.fullScreen', 'Full screen')
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
    <>
      <div
        aria-hidden
        data-agent-hub-peek-shade
        style={{ bottom: statusBarHeight }}
        // Why preventDefault: a click on the shade must not pull focus off the terminal typed in.
        onMouseDown={(event) => event.preventDefault()}
        onPointerDown={closeAgentHubPeek}
        // Peek clears focused mirrors (47), while dialogs and menus keep their higher layers.
        className="fixed inset-x-0 top-0 z-[48] bg-black/45 animate-in duration-200 fade-in-0 motion-reduce:animate-none!"
      />
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
        className="fixed z-[48] flex flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-floating outline-none"
        style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
      >
        <header className="flex h-10.5 shrink-0 items-center gap-2 border-b border-border pr-1.5 pl-2">
          {peek.index > 0 ? (
            <AgentHubActionTooltip label={translate('agentHub.peek.back', 'Previous peek')}>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground hover:text-foreground"
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
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => leave(item.openInWorkspace)}
          >
            <PanelTop aria-hidden className="size-3.5" />
            {openInLabel}
          </Button>
          {item.openExternally ? (
            <AgentHubActionTooltip label={openOutLabel}>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground hover:text-foreground"
                aria-label={openOutLabel}
                onClick={() => item.openExternally && leave(item.openExternally)}
              >
                <ExternalLink />
              </Button>
            </AgentHubActionTooltip>
          ) : null}
          <AgentHubActionTooltip label={fullScreenLabel}>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground hover:text-foreground"
              aria-label={fullScreenLabel}
              aria-pressed={fullScreen}
              onClick={() => setFullScreen(!fullScreen)}
            >
              {fullScreen ? <Shrink /> : <Expand />}
            </Button>
          </AgentHubActionTooltip>
          <AgentHubActionTooltip label={translate('agentHub.peek.close', 'Close (esc)')}>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground hover:text-foreground"
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
              routeHostId={item.content.routeHostId}
              routingWorktreeId={item.content.routingWorktreeId}
              resolveNameHere={item.content.resolveNameHere}
              onUnavailable={onUnavailable}
              onOpenPage={(url) => {
                const next = agentHubPeekPageItem(item, url)
                if (next) {
                  openAgentHubPeek({ ...next, mirrorKey: item.mirrorKey })
                }
              }}
            />
          ) : (
            <AgentHubPeekFile
              content={item.content}
              worktreeId={item.worktreeId}
              onOpenLink={(href) => openAgentHubPeekMarkdownLink(item, href)}
              onUnavailable={onUnavailable}
              onContentSize={(size) => setMeasured({ location: item.location, size })}
            />
          )}
        </div>
      </div>
    </>,
    document.body
  )
}
