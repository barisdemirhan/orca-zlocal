import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Popover, PopoverAnchor, PopoverArrow, PopoverContent } from '@/components/ui/popover'
import { useAppStore } from '@/store'
import { STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS } from '../status-bar/status-bar-context-menu-policy'
import { useAgentHubOrbPanel, closeAgentHubOrbPanel } from './agent-hub-orb-panel-store'
import { cancelDictation } from './agent-hub-dictation-cancel'
import { isDictationRunning } from './agent-hub-mirror-mic-state'
import type { AgentHubRequestBase } from '../../../../shared/agent-hub-requests'
import type { AgentHubRequestPresentation } from './agent-hub-request-presentation'
import { useAnchorBinding } from './use-anchor-binding'
import { AgentHubOrbConversation } from './AgentHubOrbConversation'
import { useAgentHubOrbSettingsSync } from './use-agent-hub-orb-settings-sync'

export function agentHubOrbAnchorRect(anchor: HTMLElement | null): DOMRect {
  return (
    anchor?.getBoundingClientRect() ??
    new DOMRect(window.innerWidth / 2, window.innerHeight - 40, 0, 0)
  )
}

function isOrbChatInteraction(target: EventTarget | null): boolean {
  const destination = useAgentHubOrbPanel.getState().destination
  if (!(target instanceof Node) || !destination) {
    return false
  }
  if (destination.contains(target)) {
    return true
  }
  // Retained chat portals keep their React ancestry outside this popover.
  return [...destination.querySelectorAll('[aria-controls]')].some((trigger) =>
    trigger
      .getAttribute('aria-controls')
      ?.split(/\s+/)
      .some((id) => destination.ownerDocument.getElementById(id)?.contains(target))
  )
}

export function AgentHubOrbPanel({
  anchorRef,
  side,
  docked,
  floating = false,
  hidden,
  requestPresentationOf
}: {
  anchorRef: RefObject<HTMLElement | null>
  side: 'top' | 'bottom' | 'left' | 'right'
  docked: boolean
  floating?: boolean
  hidden: boolean
  requestPresentationOf: (host: string, request: AgentHubRequestBase) => AgentHubRequestPresentation
}): React.JSX.Element | null {
  const session = useAgentHubOrbPanel((s) => s.session)
  const sessionId = session?.sessionId
  const ownedPointerDowns = useRef(new WeakSet<Event>())
  useEffect(() => {
    const owned = new WeakSet<Event>()
    ownedPointerDowns.current = owned
    if (!sessionId || hidden) {
      return
    }
    const recordOwnership = (event: PointerEvent): void => {
      // Selection clears aria-controls before Radix dispatches its deferred outside event.
      if (isOrbChatInteraction(event.target)) {
        owned.add(event)
      }
    }
    document.addEventListener('pointerdown', recordOwnership, true)
    return () => document.removeEventListener('pointerdown', recordOwnership, true)
  }, [sessionId, hidden])
  useAgentHubOrbSettingsSync(session !== null)
  const [anchored, setAnchored] = useState(false)
  useAnchorBinding(anchorRef, side, () => {
    setAnchored(true)
    return () => setAnchored(false)
  })
  const virtualRef = useMemo(
    () => ({ current: { getBoundingClientRect: () => agentHubOrbAnchorRect(anchorRef.current) } }),
    [anchorRef]
  )
  return (
    <Popover
      open={Boolean(session) && !hidden}
      onOpenChange={(next) => {
        if (!next) {
          closeAgentHubOrbPanel()
        }
      }}
    >
      <PopoverAnchor virtualRef={virtualRef} />
      {session ? (
        <PopoverContent
          updatePositionStrategy={floating ? 'always' : 'optimized'}
          side={anchored ? side : 'top'}
          align={docked || !anchored ? 'center' : 'end'}
          sideOffset={docked ? 12 : 8}
          collisionPadding={{ top: 8, bottom: 32, left: 8, right: 8 }}
          surface="panel"
          className="w-132 max-w-[calc(100vw-2rem)]"
          {...STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS}
          data-agent-hub-orb-panel
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => {
            if (isDictationRunning(useAppStore.getState().dictationState)) {
              event.preventDefault()
              cancelDictation()
            }
          }}
          onInteractOutside={(event) => {
            if (
              ownedPointerDowns.current.has(event.detail.originalEvent) ||
              isOrbChatInteraction(event.target) ||
              (event.target instanceof Node && anchorRef.current?.contains(event.target))
            ) {
              event.preventDefault()
            }
          }}
        >
          <AgentHubOrbConversation
            sessionId={session.sessionId}
            tabId={session.tabId}
            requestPresentationOf={requestPresentationOf}
          />
          {anchored ? <PopoverArrow width={14} height={7} /> : null}
        </PopoverContent>
      ) : null}
    </Popover>
  )
}
