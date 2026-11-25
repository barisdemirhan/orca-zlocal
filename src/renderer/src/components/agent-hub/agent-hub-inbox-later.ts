import { hideBotAskCard } from '../native-chat/bot-items/native-chat-bot-ask-later'
import { agentHubThreadCardKey, dismissAgentHubCard } from './agent-hub-answered-cards'
import type { AgentHubInboxItem, AgentHubInboxModel } from './agent-hub-inbox-model'

/** Later and Hide card are one record: the card hides and nothing is answered. */
export function laterAgentHubInboxEntry({ payload, id }: AgentHubInboxItem): void {
  if (payload.type === 'bot-item') {
    hideBotAskCard(payload.bot, payload.item.uid, payload.askId)
  } else if (payload.type === 'thread') {
    dismissAgentHubCard(agentHubThreadCardKey(payload.thread), 'inbox')
  } else if (payload.type === 'request') {
    dismissAgentHubCard(id, 'inbox')
  }
}

/** Every finished pane across both boxes, for "Mark all read". */
export function finishedAgentHubPaneKeys(inbox: AgentHubInboxModel): string[] {
  return inbox.boxes.flatMap((box) =>
    box.groups.flatMap((group) =>
      [...group.fails, ...group.results].flatMap(({ payload }) =>
        payload.type === 'finished' ? [payload.thread.paneKey] : []
      )
    )
  )
}
