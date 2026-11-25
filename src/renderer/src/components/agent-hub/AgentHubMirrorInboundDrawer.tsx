import { Inbox, X } from 'lucide-react'
import type { AgentHubMirrorInboundKind } from './agent-hub-mirror-inbound'
import { translate } from '@/i18n/i18n'
import { useAgentHubMirrorChatInbound, useAgentHubMirrorQueue } from './agent-hub-mirror-chat-feed'
import { DrawerLink, DrawerNote, DrawerRow, DrawerSection } from './AgentHubMirrorDrawerParts'

function inboundKindLabel(kind: AgentHubMirrorInboundKind): string {
  switch (kind) {
    case 'agent':
      return translate('agentHub.mirror.drawer.fromAgent', 'Agent')
    case 'connector':
      return translate('agentHub.mirror.drawer.fromConnector', 'Connector')
    case 'person':
      return translate('agentHub.mirror.drawer.fromPerson', 'Someone')
    case 'automation':
      return translate('agentHub.mirror.drawer.fromAutomation', 'Automation')
  }
}

/** Messages waiting for the agent, from the chat's own queue; a terminal agent has none to report. */
export function AgentHubMirrorInboundDrawer({
  tabId,
  isChat,
  disabled
}: {
  tabId: string
  isChat: boolean
  disabled: boolean
}): React.JSX.Element {
  const queue = useAgentHubMirrorQueue(tabId)
  const inbound = useAgentHubMirrorChatInbound(tabId)
  if (!queue) {
    return (
      <DrawerNote>
        {isChat
          ? translate(
              'agentHub.mirror.drawer.queueClosed',
              'The queue shows here while the chat is open.'
            )
          : translate(
              'agentHub.mirror.drawer.queueUnreported',
              'This terminal does not report its queue.'
            )}
      </DrawerNote>
    )
  }
  const received =
    inbound && inbound.length > 0 ? (
      <>
        <DrawerSection
          label={translate('agentHub.mirror.drawer.received', 'Received')}
          count={inbound.length}
        />
        {inbound.map((row) => (
          <DrawerRow
            key={row.id}
            lead={<Inbox className="size-3.5 shrink-0 text-muted-foreground" />}
            title={row.preview}
            trail={
              <span className="max-w-24 truncate text-[11px] text-muted-foreground">
                {row.sender ?? inboundKindLabel(row.kind)}
              </span>
            }
          >
            {row.preview}
          </DrawerRow>
        ))}
      </>
    ) : null
  if (queue.cards.length === 0 && !received) {
    return (
      <DrawerNote>
        {translate('agentHub.mirror.drawer.queueEmpty', 'Nothing is queued.')}
      </DrawerNote>
    )
  }
  return (
    <>
      {received}
      {queue.cards.length > 0 ? (
        <DrawerSection
          label={translate('agentHub.mirror.drawer.queued', 'Queued')}
          count={queue.cards.length}
        />
      ) : null}
      {queue.cards.map((card) => (
        <DrawerRow
          key={card.messageId}
          lead={<span className="size-2 shrink-0 rounded-full border border-muted-foreground" />}
          title={card.displayText ?? card.text}
          trail={
            <>
              {queue.editCapable && !card.notEditable ? (
                <DrawerLink disabled={disabled} onClick={() => void queue.edit(card.messageId)}>
                  {translate('agentHub.mirror.drawer.edit', 'Edit')}
                </DrawerLink>
              ) : null}
              {card.state === 'waiting' && !card.waitsForAgent ? (
                <DrawerLink disabled={disabled} onClick={() => void queue.steer(card.messageId)}>
                  {translate('agentHub.mirror.drawer.sendNow', 'Send now')}
                </DrawerLink>
              ) : null}
              <button
                type="button"
                disabled={disabled}
                aria-label={translate('agentHub.mirror.drawer.removeQueued', 'Remove from queue')}
                onClick={() => void queue.remove(card.messageId)}
                className="text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                <X className="size-3" />
              </button>
            </>
          }
        >
          {card.displayText ?? card.text}
        </DrawerRow>
      ))}
    </>
  )
}
