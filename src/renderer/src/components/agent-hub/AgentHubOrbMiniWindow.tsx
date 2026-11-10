import { useLayoutEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, Maximize2, Moon, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { translate } from '@/i18n/i18n'
import {
  NATIVE_CHAT_PERMISSION_MODE_ICONS,
  nativeChatPermissionModeLabel
} from '../native-chat/session/options/controls/native-chat-permission-mode-labels'
import { AgentHubOrbHeaderAction } from './AgentHubOrbConversationHeader'
import { AgentHubActionTooltip } from './AgentHubShortcut'
import { AgentHubOrbSphere, type AgentHubOrbSphereProps } from './AgentHubOrbSphere'
import { setAgentHubOrbRequestDestination } from './agent-hub-orb-panel-store'
import { useAgentHubOrbMiniWindowDrag } from './use-agent-hub-orb-mini-window-drag'
import { useAgentHubOrbPermissionMode } from './use-agent-hub-orb-permission-mode'
import { useAgentHubOrbName } from './use-agent-hub-orb-identity'
import './agent-hub-orb-stage.css'

/** The narrow chat that opens where the sphere was: the retained chat under a draggable header. */
export function AgentHubOrbMiniWindow({
  sessionId,
  sphere,
  agentLabel,
  busy,
  request,
  requestVisible,
  memory,
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
  memory?: ReactNode
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
  const title = useAgentHubOrbName()
  const backLabel = translate('agentHub.orb.backToOrb', 'Back to Orb')
  const permissionLabel = permission ? nativeChatPermissionModeLabel(permission) : ''
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
        <AgentHubActionTooltip label={backLabel} actionId="agentHub.orb.toggleConversation">
          <button
            type="button"
            aria-label={backLabel}
            className="-ml-1 inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-md pr-1.5 pl-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            onClick={onMinimize}
          >
            <ChevronLeft aria-hidden className="size-3.5" />
            <span className="inline-flex size-5">
              <AgentHubOrbSphere {...sphere} />
            </span>
            <span className="text-sm font-semibold text-foreground">{title}</span>
          </button>
        </AgentHubActionTooltip>
        {agentLabel ? (
          <span className="min-w-0 truncate text-xs text-muted-foreground">{agentLabel}</span>
        ) : null}
        {permission && PermissionIcon ? (
          <AgentHubActionTooltip label={permissionLabel}>
            <Badge variant="outline" aria-label={permissionLabel} className="shrink-0">
              <PermissionIcon aria-hidden />
            </Badge>
          </AgentHubActionTooltip>
        ) : null}
        <span className="flex-1" />
        <AgentHubOrbHeaderAction
          label={translate('agentHub.orb.openFullChat', 'Open full chat')}
          onClick={onShowChat}
        >
          <Maximize2 />
        </AgentHubOrbHeaderAction>
        <AgentHubOrbHeaderAction
          label={translate('agentHub.orb.sleepNamed', 'Put {{name}} to sleep', { name: title })}
          disabled={busy}
          onClick={onSleep}
        >
          <Moon />
        </AgentHubOrbHeaderAction>
        <AgentHubOrbHeaderAction
          label={translate('agentHub.orb.hideNamed', 'Hide {{name}}', { name: title })}
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
      {memory}
      {children}
    </section>,
    container
  )
}
