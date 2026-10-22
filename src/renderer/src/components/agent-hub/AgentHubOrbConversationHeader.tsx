import { ArrowLeft, History, Minimize2, Plus, Settings, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { AgentHubActionTooltip } from './AgentHubShortcut'
import { useAgentHubOrbAwarenessStore } from './agent-hub-orb-awareness-store'
import { AgentHubOrbQuotaChip } from './AgentHubOrbQuotaChip'

function HeaderAction({
  label,
  actionId,
  disabled,
  onClick,
  children
}: {
  label: string
  actionId?: string
  disabled?: boolean
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
  onMinimize,
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
  onMinimize: () => void
  onClose: () => void
  requestAction?: ReactNode
}): React.JSX.Element {
  const historyLabel = translate('auto.agentHub.orb.pastConversations', 'Past conversations')
  const settingsLabel = translate('auto.agentHub.orb.settings', 'Orb settings')
  const newLabel = translate('auto.agentHub.orb.newConversation', 'New')
  const deliveryUnverifiable = useAgentHubOrbAwarenessStore((s) => s.delivery === 'unverifiable')
  const deliveryLabel = translate(
    'agentHub.orb.deliveryUnverifiable',
    'Orb may not have the latest agent states'
  )
  return (
    <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
      {!chatVisible ? (
        <HeaderAction
          label={translate('auto.agentHub.orb.backToConversation', 'Back to conversation')}
          disabled={busy}
          onClick={onBack}
        >
          <ArrowLeft />
        </HeaderAction>
      ) : null}
      <span className="text-sm font-semibold">
        {history
          ? historyLabel
          : settingsView
            ? settingsLabel
            : translate('auto.agentHub.orb.title', 'Orb')}
      </span>
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
      ) : !settingsView ? (
        <HeaderAction label={historyLabel} disabled={busy} onClick={onHistory}>
          <History />
        </HeaderAction>
      ) : null}
      {chatVisible ? (
        <HeaderAction label={newLabel} disabled={busy} onClick={onNew}>
          <Plus />
        </HeaderAction>
      ) : null}
      {!settingsView ? (
        <HeaderAction label={settingsLabel} disabled={busy} onClick={onSettings}>
          <Settings />
        </HeaderAction>
      ) : null}
      {chatVisible ? (
        <HeaderAction
          label={translate('auto.agentHub.orb.minimize', 'Minimize Orb')}
          actionId="agentHub.orb.toggleConversation"
          onClick={onMinimize}
        >
          <Minimize2 />
        </HeaderAction>
      ) : null}
      <HeaderAction label={translate('agentHub.close', 'Close')} onClick={onClose}>
        <X />
      </HeaderAction>
    </header>
  )
}
