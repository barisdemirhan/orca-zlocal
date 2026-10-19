import { ArrowLeft, History, Minimize2, Plus, Settings, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'

function HeaderAction({
  label,
  disabled,
  onClick,
  children
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
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
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
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
      {chatVisible && agentLabel ? (
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{agentLabel}</span>
      ) : (
        <span className="flex-1" />
      )}
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
