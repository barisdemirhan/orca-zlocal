import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, Minus, SendHorizontal, X } from 'lucide-react'
import { useAppStore } from '@/store'
import { submitPromptToAgentPty } from '@/lib/agent-paste-draft'
import { translate } from '@/i18n/i18n'
import { AgentTerminalPreview } from '../dashboard-popout/AgentTerminalPreview'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import { useNativeChatInteractiveSend } from '../native-chat/use-native-chat-interactive-send'
import { HubAvatar, HubCrumb, HubKeys, HubStateIndicator } from './AgentHubAtoms'
import { agentHubIndicatorKind } from './agent-hub-lists'
import {
  resolveAgentHubTerminalInput,
  type AgentHubLocation,
  type AgentHubPaneTarget
} from './agent-hub-pane-target'
import {
  clampAgentHubMirrorGeometry,
  defaultAgentHubMirrorGeometry,
  type AgentHubMirrorGeometry
} from './agent-hub-mirror-geometry'
import { rememberAgentHubMirrorOrigin } from './agent-hub-mirror-store'
import { useAgentHubLivePty } from './use-agent-hub-live-pty'

// A tab that has not attached by then is not coming back on its own.
const ATTACH_GIVE_UP_MS = 10_000

// Why module scope: reopening the mirror lands where the user last left it this session.
let lastGeometry: AgentHubMirrorGeometry | null = null

function viewportSize(): { width: number; height: number } {
  return { width: window.innerWidth, height: window.innerHeight }
}

type DragState = {
  mode: 'move' | 'resize'
  pointerX: number
  pointerY: number
  start: AgentHubMirrorGeometry
}

/** The mock's prompt row: agents get a bracketed paste + Enter, shells a typed line. */
function MirrorSendBar({
  target,
  ptyId,
  asking
}: {
  target: AgentHubPaneTarget
  ptyId: string | null
  asking: boolean
}): React.JSX.Element {
  const [value, setValue] = useState('')
  const send = useNativeChatInteractiveSend(
    target.tab.id,
    target.paneKey ?? target.tab.id,
    ptyId,
    target.agentType ?? 'unknown'
  )
  const placeholder = asking
    ? translate('agentHub.mirror.answerPlaceholder', 'Type 1–9 or an answer…')
    : target.agentType
      ? translate('agentHub.mirror.sendTo', 'Send to @{{value0}}…', { value0: target.agentType })
      : translate('agentHub.mirror.sendToShell', 'Send to shell…')
  return (
    <form
      className="flex shrink-0 items-center gap-1.5 border-t border-border bg-background/60 py-[5px] pr-[5px] pl-3"
      onSubmit={(event) => {
        event.preventDefault()
        const text = value.trim()
        if (!text || !ptyId) {
          return
        }
        setValue('')
        if (asking && /^[1-9]$/.test(text)) {
          send.sendRaw(text)
        } else if (target.agentType) {
          void submitPromptToAgentPty({ tabId: target.tab.id, ptyId, content: text })
        } else {
          send.sendRaw(`${text}\r`)
        }
      }}
    >
      <span className="font-mono text-muted-foreground">›</span>
      <input
        value={value}
        disabled={!ptyId}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent font-mono text-[12.5px] outline-none placeholder:text-muted-foreground/70"
      />
      <button
        type="submit"
        disabled={!ptyId || !value.trim()}
        aria-label={translate('agentHub.card.send', 'Send')}
        className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground disabled:opacity-50"
      >
        <SendHorizontal className="size-3.5" />
      </button>
    </form>
  )
}

/**
 * Non-modal, draggable live mirror of one terminal pane, typed into like the pane itself.
 * The preview claims the PTY grid while open (see createPreviewGridClaim), so the real pane
 * follows the mirror's size until it closes.
 */
export function AgentHubMirrorWindow({
  target,
  thread,
  location,
  onClose,
  onMinimize,
  onReveal
}: {
  target: AgentHubPaneTarget
  /** Live thread for an agent pane, for its state glyph; null for a shell. */
  thread: AgentPaneThread | null
  location: AgentHubLocation
  onClose: () => void
  /** Shrinks the window into a chip where it stands; the mirror keeps running. */
  onMinimize: () => void
  onReveal: () => void
}): React.JSX.Element {
  const [geometry, setGeometry] = useState<AgentHubMirrorGeometry>(() =>
    clampAgentHubMirrorGeometry(
      lastGeometry ?? defaultAgentHubMirrorGeometry(viewportSize()),
      viewportSize()
    )
  )
  const dragRef = useRef<DragState | null>(null)
  const ptyId = useAgentHubLivePty(target.worktree.id, target.tab.id, target.paneKey)
  const [gaveUp, setGaveUp] = useState(false)
  const terminalInput = useMemo(
    () => (ptyId ? resolveAgentHubTerminalInput(useAppStore.getState(), target, ptyId) : null),
    [ptyId, target]
  )
  const kind = thread ? agentHubIndicatorKind(thread) : 'idle'

  useEffect(() => {
    lastGeometry = geometry
    rememberAgentHubMirrorOrigin({ x: geometry.x, y: geometry.y })
  }, [geometry])

  useEffect(() => {
    if (ptyId) {
      return
    }
    const timer = setTimeout(() => setGaveUp(true), ATTACH_GIVE_UP_MS)
    return () => clearTimeout(timer)
  }, [ptyId])

  useEffect(() => {
    const onResize = (): void =>
      setGeometry((current) => clampAgentHubMirrorGeometry(current, viewportSize()))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const beginDrag = useCallback(
    (mode: DragState['mode']) =>
      (event: React.PointerEvent<HTMLElement>): void => {
        const onButton = event.target instanceof Element && event.target.closest('button') !== null
        if (event.button !== 0 || (mode === 'move' && onButton)) {
          return
        }
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        dragRef.current = {
          mode,
          pointerX: event.clientX,
          pointerY: event.clientY,
          start: geometry
        }
      },
    [geometry]
  )

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLElement>): void => {
    const drag = dragRef.current
    if (!drag) {
      return
    }
    const dx = event.clientX - drag.pointerX
    const dy = event.clientY - drag.pointerY
    const next =
      drag.mode === 'move'
        ? { ...drag.start, x: drag.start.x + dx, y: drag.start.y + dy }
        : { ...drag.start, width: drag.start.width + dx, height: drag.start.height + dy }
    setGeometry(clampAgentHubMirrorGeometry(next, viewportSize()))
  }, [])

  const endDrag = useCallback((event: React.PointerEvent<HTMLElement>): void => {
    if (dragRef.current) {
      dragRef.current = null
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  const handle = thread?.currentAgentEntry?.terminalHandle

  return createPortal(
    <section
      role="dialog"
      aria-label={target.title}
      data-agent-hub-mirror
      // Why z-[46]: above the floating workspace panel (z-45), below modal layers (z-50).
      // Why the strong edge: the mirror floats over terminals that share its background.
      className="fixed z-[46] flex flex-col overflow-hidden rounded-xl border border-foreground/25 bg-background shadow-floating"
      style={{ left: geometry.x, top: geometry.y, width: geometry.width, height: geometry.height }}
      onKeyDown={(event) => {
        // Why: Esc inside the terminal belongs to the agent (interrupt), not to the window.
        if (
          event.key === 'Escape' &&
          !(event.target instanceof HTMLElement && event.target.closest('.xterm'))
        ) {
          event.preventDefault()
          onClose()
        }
      }}
    >
      <header
        className="flex h-[42px] shrink-0 cursor-grab items-center gap-[9px] border-b border-border bg-popover pr-1.5 pl-3 select-none active:cursor-grabbing"
        onPointerDown={beginDrag('move')}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <HubStateIndicator kind={kind} />
        <HubAvatar agentType={target.agentType} kind={thread ? kind : null} />
        <div className="min-w-0 flex-1 text-[12.5px]">
          <div className="truncate font-semibold">{target.title}</div>
          <div className="[&>span]:text-[11px]">
            <HubCrumb location={location} />
          </div>
        </div>
        <button
          type="button"
          onClick={onReveal}
          className="flex items-center gap-1.5 rounded-[7px] px-[7px] py-[5px] text-xs text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground"
        >
          {translate('agentHub.mirror.openInOrca', 'Open in Orca')}
          <HubKeys keys={['↵']} />
        </button>
        <button
          type="button"
          aria-label={translate('agentHub.mirror.minimize', 'Minimize')}
          title={translate('agentHub.mirror.minimize', 'Minimize')}
          onClick={onMinimize}
          className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground"
        >
          <Minus className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label={translate('agentHub.mirror.close', 'Close mirror')}
          onClick={onClose}
          className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </header>
      {ptyId ? (
        <AgentTerminalPreview
          key={ptyId}
          ptyId={ptyId}
          terminalInput={terminalInput}
          className="h-auto min-h-0 flex-1"
          // Why no claim: resizing the PTY to this small window reflowed the agent and left
          // its real pane narrow after "Open in Orca"; a scaled view keeps the pane intact.
          claimGrid={false}
        />
      ) : (
        <div className="flex min-h-0 flex-1 items-start gap-2 px-3.5 py-3 font-mono text-xs text-muted-foreground">
          {gaveUp ? (
            translate('agentHub.mirror.noTerminal', 'This pane has no live terminal right now.')
          ) : (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              {translate('agentHub.mirror.connecting', 'Connecting to the terminal…')}
            </>
          )}
        </div>
      )}
      <MirrorSendBar target={target} ptyId={ptyId} asking={kind === 'ask'} />
      <div className="flex shrink-0 justify-between gap-2.5 overflow-hidden border-t border-border bg-background px-3 py-[5px] font-mono text-[10.5px] whitespace-nowrap text-muted-foreground/70">
        <span>{translate('agentHub.mirror.liveMirror', 'live mirror')}</span>
        {handle ? <span className="truncate">{handle}</span> : null}
      </div>
      <div
        aria-hidden
        className="absolute right-0 bottom-0 size-3 cursor-nwse-resize"
        onPointerDown={beginDrag('resize')}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      />
    </section>,
    document.body
  )
}
