import { translate } from '@/i18n/i18n'
import { decideAccessRequest, reviewAccessRequest } from '@/lib/bot-access-requests'
import { manageConnectors } from '../bots/AddConnectorDialog'
import { botConnectorTitleText } from '../bots/bot-connector-titles'
import { dismissSuggestion, startSuggestion } from '../bots/bot-up-next-actions'
import { CONNECTOR_SOURCE_NAMES } from '../../../../shared/connectors/external-conversation-link'
import { HubSection } from './AgentHubSectionHeader'
import { AgentHubBotAskRow, AgentHubBotNameButton } from './AgentHubBotAskRow'
import { AgentHubBotAvatar } from './AgentHubBotMark'
import {
  useAgentHubBotNeedsList,
  useAgentHubBotNeedsTotal,
  type AgentHubBotNeeds
} from './agent-hub-bot-needs-store'

function ActionButton({
  label,
  onClick
}: {
  label: string
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={onClick}
      className="rounded-md border border-foreground/[0.08] bg-foreground/[0.03] px-2 py-1 text-xs text-foreground transition-colors hover:border-foreground/15 hover:bg-foreground/[0.07]"
    >
      {label}
    </button>
  )
}

function NeedLine({
  needs,
  title,
  detail,
  actions,
  kind
}: {
  needs: AgentHubBotNeeds
  title: string
  detail: string
  actions: React.ReactNode
  kind: 'sign-in' | 'access' | 'suggestion'
}): React.JSX.Element {
  return (
    <div data-agent-hub-bot-need={kind} className="flex items-start gap-2.5 rounded-lg px-2 py-2">
      <AgentHubBotAvatar identity={{ bot: needs.bot, origin: 'home' }} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <AgentHubBotNameButton bot={needs.bot} />
        <span className="text-xs text-foreground/80">{title}</span>
        <span className="text-xs text-muted-foreground">{detail}</span>
        <div className="flex flex-wrap gap-1">{actions}</div>
      </div>
    </div>
  )
}

function BotNeedsBlock({ needs }: { needs: AgentHubBotNeeds }): React.JSX.Element {
  const { bot } = needs
  return (
    <div data-agent-hub-bot-needs={needs.botKey}>
      {needs.items.map((item) => (
        <AgentHubBotAskRow key={item.uid} bot={bot} item={item} />
      ))}
      {needs.connectors.map(({ key, connector }) => {
        const name = botConnectorTitleText(connector.title)
        return (
          <NeedLine
            key={key}
            needs={needs}
            kind="sign-in"
            title={translate('agentHub.bots.connector', '{{name}} needs you', { name })}
            detail={translate('agentHub.bots.connectorHint', 'Sign in again to keep it working')}
            actions={
              <ActionButton
                label={translate('agentHub.bots.fixConnector', 'Open {{name}}', { name })}
                onClick={() => manageConnectors(bot, key)}
              />
            }
          />
        )
      })}
      {needs.access.map((request) => (
        <NeedLine
          key={request.requestId}
          needs={needs}
          kind="access"
          title={translate('agentHub.bots.access', '{{person}} asked for access', {
            person: request.requester.name || request.requester.handle
          })}
          detail={`${CONNECTOR_SOURCE_NAMES[request.source]} · ${request.workspaceName}`}
          actions={
            <>
              <ActionButton
                label={translate('agentHub.bots.accessReview', 'Review and approve')}
                onClick={() => reviewAccessRequest(request)}
              />
              <ActionButton
                label={translate('agentHub.bots.accessDeny', 'Deny')}
                onClick={() => void decideAccessRequest(request, 'declined')}
              />
            </>
          }
        />
      ))}
      {needs.suggestions.map((suggestion) => (
        <NeedLine
          key={suggestion.id}
          needs={needs}
          kind="suggestion"
          title={suggestion.title}
          detail={suggestion.why}
          actions={
            <>
              <ActionButton
                label={translate('agentHub.bots.suggestionStart', 'Start')}
                onClick={() => void startSuggestion(bot, suggestion.id)}
              />
              <ActionButton
                label={translate('agentHub.bots.suggestionDismiss', 'Dismiss')}
                onClick={() => void dismissSuggestion(bot, suggestion.id)}
              />
            </>
          }
        />
      ))}
    </div>
  )
}

/** Whether the Inbox has bot asks, so its empty state stays hidden. */
export function useAgentHubBotNeedsShown(): boolean {
  return useAgentHubBotNeedsTotal() > 0
}

/** The Inbox's bot section: each bot's asks, sign-ins, access requests and suggestions. */
export function AgentHubBotNeedsSection(): React.JSX.Element | null {
  const list = useAgentHubBotNeedsList()
  const total = useAgentHubBotNeedsTotal()
  const shown = list.filter((needs) => needs.count > 0 || needs.suggestions.length > 0)
  if (shown.length === 0) {
    return null
  }
  return (
    <div data-agent-hub-bot-inbox>
      <HubSection label={translate('agentHub.bots.needsYou', 'Bots')} count={total} tone="ask" />
      {shown.map((needs) => (
        <BotNeedsBlock key={needs.botKey} needs={needs} />
      ))}
    </div>
  )
}
