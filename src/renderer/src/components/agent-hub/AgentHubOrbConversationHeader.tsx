import {
  AppWindow,
  ArrowLeft,
  ChevronDown,
  History,
  Minimize2,
  Moon,
  Plus,
  Settings,
  X
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import { AgentHubActionTooltip } from './AgentHubShortcut'
import { useAgentHubOrbAwarenessStore } from './agent-hub-orb-awareness-store'
import { AgentHubOrbQuotaChip } from './AgentHubOrbQuotaChip'
import { useAgentHubOrbName } from './use-agent-hub-orb-identity'

export function AgentHubOrbHeaderAction({
  label,
  actionId,
  disabled,
  pressed,
  onClick,
  children
}: {
  label: string
  actionId?: string
  disabled?: boolean
  pressed?: boolean
  onClick: () => void
  children: ReactNode
}): React.JSX.Element {
  return (
    <AgentHubActionTooltip label={label} actionId={actionId}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        aria-pressed={pressed}
        className="aria-pressed:bg-accent aria-pressed:text-accent-foreground"
        disabled={disabled}
        onClick={onClick}
      >
        {children}
      </Button>
    </AgentHubActionTooltip>
  )
}

export function AgentHubOrbConversationHeader({
  history,
  settingsView,
  chatVisible,
  busy,
  agentLabel,
  onBack,
  onHistory,
  onSettings,
  onNew,
  onMiniWindow,
  onMinimize,
  onSleep,
  onClose,
  requestAction
}: {
  history: boolean
  settingsView: boolean
  chatVisible: boolean
  busy: boolean
  agentLabel: string | null
  onBack: () => void
  onHistory: () => void
  onSettings: () => void
  onNew: () => void
  onMiniWindow: () => void
  onMinimize: () => void
  onSleep: () => void
  onClose: () => void
  requestAction?: ReactNode
}): React.JSX.Element {
  const name = useAgentHubOrbName()
  const historyLabel = translate('auto.agentHub.orb.pastConversations', 'Past conversations')
  const settingsLabel = translate('auto.agentHub.orb.settings', 'Orb settings')
  const newLabel = translate('auto.agentHub.orb.newConversation', 'New')
  const sleepLabel = translate('agentHub.orb.sleepNamed', 'Put {{name}} to sleep', { name })
  const deliveryUnverifiable = useAgentHubOrbAwarenessStore((s) => s.delivery === 'unverifiable')
  const deliveryLabel = translate(
    'agentHub.orb.deliveryUnverifiable',
    'Orb may not have the latest agent states'
  )
  return (
    <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
      {!chatVisible ? (
        <AgentHubOrbHeaderAction
          label={translate('auto.agentHub.orb.backToConversation', 'Back to conversation')}
          disabled={busy}
          onClick={onBack}
        >
          <ArrowLeft />
        </AgentHubOrbHeaderAction>
      ) : null}
      {chatVisible ? (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={translate('agentHub.orb.menuNamed', '{{name}} menu', { name })}
              className="-ml-1.5 gap-1 px-1.5 text-sm font-semibold"
            >
              {name}
              <ChevronDown aria-hidden className="size-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem disabled={busy} onSelect={onHistory}>
              <History />
              {historyLabel}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={busy} onSelect={onSettings}>
              <Settings />
              {settingsLabel}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={busy} onSelect={onSleep}>
              <Moon />
              {sleepLabel}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <span className="text-sm font-semibold">
          {history ? historyLabel : settingsView ? settingsLabel : name}
        </span>
      )}
      {chatVisible && deliveryUnverifiable ? (
        <AgentHubActionTooltip label={deliveryLabel}>
          <span
            role="img"
            aria-label={deliveryLabel}
            className="size-1.5 shrink-0 rounded-full bg-status-warning"
          />
        </AgentHubActionTooltip>
      ) : null}
      {chatVisible && agentLabel ? (
        <span className="min-w-0 truncate text-xs text-muted-foreground">{agentLabel}</span>
      ) : null}
      {chatVisible ? <AgentHubOrbQuotaChip /> : null}
      <span className="flex-1" />
      {requestAction}
      {history ? (
        <Button type="button" variant="outline" size="xs" disabled={busy} onClick={onNew}>
          {newLabel}
        </Button>
      ) : null}
      {chatVisible ? (
        <>
          <AgentHubOrbHeaderAction label={newLabel} disabled={busy} onClick={onNew}>
            <Plus />
          </AgentHubOrbHeaderAction>
          <AgentHubOrbHeaderAction
            label={translate('agentHub.orb.miniWindow', 'Floating window')}
            onClick={onMiniWindow}
          >
            <AppWindow />
          </AgentHubOrbHeaderAction>
          <AgentHubOrbHeaderAction
            label={translate('auto.agentHub.orb.minimize', 'Minimize Orb')}
            actionId="agentHub.orb.toggleConversation"
            onClick={onMinimize}
          >
            <Minimize2 />
          </AgentHubOrbHeaderAction>
        </>
      ) : null}
      <AgentHubOrbHeaderAction
        label={translate('agentHub.orb.hideNamed', 'Hide {{name}}', { name })}
        onClick={onClose}
      >
        <X />
      </AgentHubOrbHeaderAction>
    </header>
  )
}
