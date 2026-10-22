import { useLayoutEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Maximize2, Minimize2, Moon, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { translate } from '@/i18n/i18n'
import {
  NATIVE_CHAT_PERMISSION_MODE_ICONS,
  nativeChatPermissionModeLabel
} from '../native-chat/native-chat-permission-mode-labels'
import { AgentHubOrbHeaderAction } from './AgentHubOrbConversationHeader'
import { AgentHubOrbSphere, type AgentHubOrbSphereProps } from './AgentHubOrbSphere'
import { setAgentHubOrbRequestDestination } from './agent-hub-orb-panel-store'
import { useAgentHubOrbMiniWindowDrag } from './use-agent-hub-orb-mini-window-drag'
import { useAgentHubOrbPermissionMode } from './use-agent-hub-orb-permission-mode'
import './agent-hub-orb-stage.css'

/** The narrow chat that opens where the sphere was: the retained chat under a draggable header. */
export function AgentHubOrbMiniWindow({
  sessionId,
  sphere,
  agentLabel,
  busy,
  request,
  requestVisible,
  onShowChat,
  onMinimize,
  onSleep,
  onHide,
  children
}: {
  sessionId: string
  sphere: AgentHubOrbSphereProps
  agentLabel: string | null
  busy: boolean
  request: ReactNode
  requestVisible: boolean
  onShowChat: () => void
  onMinimize: () => void
  onSleep: () => void
  onHide: () => void
  children: ReactNode
}): React.JSX.Element {
  const [container] = useState(() => document.createElement('div'))
  useLayoutEffect(() => {
    document.body.appendChild(container)
    return () => container.remove()
  }, [container])
  const { frame, ...drag } = useAgentHubOrbMiniWindowDrag()
  const permission = useAgentHubOrbPermissionMode(sessionId)
  const PermissionIcon = permission ? NATIVE_CHAT_PERMISSION_MODE_ICONS[permission] : null
  const title = translate('auto.agentHub.orb.title', 'Orb')
  return createPortal(
    <section
      aria-label={title}
      data-agent-hub-orb-mini-window
      className="agent-hub-orb-mini-window fixed z-[47] flex flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-floating"
      style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}
    >
      <header
        className="flex shrink-0 cursor-grab touch-none select-none items-center gap-1.5 border-b border-border py-1.5 pr-1.5 pl-2 active:cursor-grabbing"
        {...drag}
      >
        <span className="inline-flex size-6 shrink-0">
          <AgentHubOrbSphere {...sphere} />
        </span>
        <span className="min-w-0 truncate text-xs font-medium">{agentLabel ?? title}</span>
        {permission && PermissionIcon ? (
          <Badge variant="outline">
            <PermissionIcon aria-hidden />
            {nativeChatPermissionModeLabel(permission)}
          </Badge>
        ) : null}
        <span className="flex-1" />
        <AgentHubOrbHeaderAction
          label={translate('auto.agentHub.orb.showConversation', 'Show conversation')}
          onClick={onShowChat}
        >
          <Maximize2 />
        </AgentHubOrbHeaderAction>
        <AgentHubOrbHeaderAction
          label={translate('auto.agentHub.orb.minimize', 'Minimize Orb')}
          actionId="agentHub.orb.toggleConversation"
          onClick={onMinimize}
        >
          <Minimize2 />
        </AgentHubOrbHeaderAction>
        <AgentHubOrbHeaderAction
          label={translate('agentHub.orb.sleep', 'Put Orb to sleep')}
          disabled={busy}
          onClick={onSleep}
        >
          <Moon />
        </AgentHubOrbHeaderAction>
        <AgentHubOrbHeaderAction
          label={translate('agentHub.orb.hide', 'Hide Orb')}
          onClick={onHide}
        >
          <X />
        </AgentHubOrbHeaderAction>
      </header>
      <div
        ref={setAgentHubOrbRequestDestination}
        data-agent-hub-orb-request-host
        className="agent-hub-orb-request-host scrollbar-sleek"
        hidden={!requestVisible}
      >
        {request}
      </div>
      {children}
    </section>,
    container
  )
}
