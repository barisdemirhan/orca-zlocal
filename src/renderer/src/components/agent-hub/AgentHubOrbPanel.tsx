import { useMemo, useState, type RefObject } from 'react'
import { Popover, PopoverAnchor, PopoverArrow, PopoverContent } from '@/components/ui/popover'
import { useAppStore } from '@/store'
import { STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS } from '../status-bar/composition/status-bar-context-menu-policy'
import { useAgentHubOrbPanel, closeAgentHubOrbPanel } from './agent-hub-orb-panel-store'
import { cancelDictation } from './agent-hub-dictation-cancel'
import { isDictationRunning } from './agent-hub-mirror-mic-state'
import { readAgentHubDictationSession } from './agent-hub-dictation-origin'
import type { AgentHubRequestBase } from '../../../../shared/agent-hub-requests'
import type { AgentHubRequestPresentation } from './agent-hub-request-presentation'
import { useAnchorBinding } from './use-anchor-binding'
import { AgentHubOrbConversation } from './AgentHubOrbConversation'
import { useAgentHubOrbSettingsSync } from './use-agent-hub-orb-settings-sync'
import { useAgentHubOrbVoice } from './use-agent-hub-orb-voice'
import type { AgentHubOrbState } from './agent-hub-orb-state'

const IDLE_ORB_STATE: AgentHubOrbState = { kind: 'idle' }

export function agentHubOrbAnchorRect(anchor: HTMLElement | null): DOMRect {
  return (
    anchor?.getBoundingClientRect() ??
    new DOMRect(window.innerWidth / 2, window.innerHeight - 40, 0, 0)
  )
}

export function AgentHubOrbPanel({
  anchorRef,
  side,
  docked,
  floating = false,
  hidden,
  state = IDLE_ORB_STATE,
  requestPresentationOf
}: {
  anchorRef: RefObject<HTMLElement | null>
  side: 'top' | 'bottom' | 'left' | 'right'
  docked: boolean
  floating?: boolean
  hidden: boolean
  state?: AgentHubOrbState
  requestPresentationOf: (host: string, request: AgentHubRequestBase) => AgentHubRequestPresentation
}): React.JSX.Element | null {
  const session = useAgentHubOrbPanel((s) => s.session)
  const chatVisible = useAgentHubOrbPanel((s) => s.chatVisible)
  const presentation = useAgentHubOrbPanel((s) => s.presentation)
  const compact = useAgentHubOrbPanel((s) => s.compact)
  const voice = useAgentHubOrbVoice(session, !hidden && chatVisible)
  const orbOnly = chatVisible && (presentation !== 'chat' || compact)
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
          className="z-[47] flex w-132 max-w-[calc(100vw-2rem)] flex-col"
          style={{
            maxHeight: 'var(--radix-popover-content-available-height)',
            visibility: orbOnly ? 'hidden' : undefined,
            pointerEvents: orbOnly ? 'none' : undefined
          }}
          {...STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS}
          data-agent-hub-orb-panel
          data-agent-hub-orb-only={orbOnly ? '' : undefined}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => {
            const requestDestination = useAgentHubOrbPanel.getState().requestDestination
            if (
              event.defaultPrevented ||
              (event.target instanceof Node && requestDestination?.contains(event.target))
            ) {
              event.preventDefault()
              return
            }
            if (voice.output === 'speaking') {
              event.preventDefault()
              voice.stopSpeaking()
            } else if (voice.connection === 'connecting' || voice.connection === 'live') {
              event.preventDefault()
              void voice.stopLive()
            } else if (
              session.tabId &&
              isDictationRunning(useAppStore.getState().dictationState) &&
              readAgentHubDictationSession()?.pane?.tabId === session.tabId
            ) {
              event.preventDefault()
              cancelDictation()
            } else if (presentation === 'mini' && !compact) {
              // Why: Escape in the mini window steps back to the sphere, not out of Orb.
              event.preventDefault()
              useAgentHubOrbPanel.setState({ presentation: 'orb' })
            }
          }}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <AgentHubOrbConversation
            sessionId={session.sessionId}
            tabId={session.tabId}
            state={state}
            voice={voice}
            visible={!hidden}
            requestPresentationOf={requestPresentationOf}
          />
          {anchored ? <PopoverArrow width={14} height={7} /> : null}
        </PopoverContent>
      ) : null}
    </Popover>
  )
}
