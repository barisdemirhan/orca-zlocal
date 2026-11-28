import { agentHubAlertText } from './agent-hub-alert-text'
import type { AgentHubAlert, AgentHubBotAlert } from './agent-hub-alerts'
import {
  botQuestionTextKey,
  mergeBotAlerts,
  type BotAlertFacet,
  type BotAlertFacetKind
} from './agent-hub-bot-alert-merge'

export type AgentHubBotAlertBubble = {
  lead: AgentHubBotAlert
  updates: number
  ids: readonly string[]
}

function chatKey(session: string): string {
  return `chat:${session}`
}

function facetOf(alert: AgentHubBotAlert): BotAlertFacet {
  const { subject, botKey } = alert.bot
  const base = { id: alert.id, botKey }
  switch (subject.type) {
    case 'item': {
      const question = subject.item.question
      return {
        ...base,
        kind: 'ask',
        source: 'item',
        questionKeys: [
          ...(question ? [`id:${question.eventId}`, botQuestionTextKey(question.text)] : []),
          ...(subject.item.madeBy ? [chatKey(subject.item.madeBy.chatId)] : [])
        ]
      }
    }
    case 'signin':
    case 'access':
      return { ...base, kind: subject.type, source: 'item', questionKeys: [] }
    case 'runs': {
      const kind: BotAlertFacetKind = alert.kind === 'failure' ? 'failure' : 'result'
      const sessions = subject.runs.flatMap((run) =>
        run.sessionId ? [chatKey(run.sessionId)] : []
      )
      return { ...base, kind, source: 'event', questionKeys: sessions }
    }
    case 'thread': {
      const kind: BotAlertFacetKind =
        alert.kind === 'ask' ? 'ask' : alert.kind === 'failure' ? 'failure' : 'result'
      const text = alert.kind === 'ask' ? agentHubAlertText(subject.alert) : ''
      const keys = [
        ...(subject.session ? [chatKey(subject.session)] : []),
        ...(text ? [botQuestionTextKey(text)] : [])
      ]
      return { ...base, kind, source: 'chat', questionKeys: keys }
    }
    case 'request':
      return {
        ...base,
        kind: alert.kind === 'ask' ? 'ask' : 'result',
        source: 'request',
        questionKeys: []
      }
    case 'suggestion':
      return { ...base, kind: 'result', source: 'suggestion', questionKeys: [] }
  }
}

/** The queue's bot alerts as one bubble per bot, oldest first; agents' alerts are left to the caller. */
export function agentHubBotAlertBubbles(
  alerts: readonly AgentHubAlert[]
): AgentHubBotAlertBubble[] {
  const bots = alerts.filter((alert): alert is AgentHubBotAlert => alert.bot !== undefined)
  const byId = new Map(bots.map((alert) => [alert.id, alert]))
  return mergeBotAlerts(bots.map(facetOf)).flatMap((group) => {
    const lead = byId.get(group.lead.id)
    return lead ? [{ lead, updates: group.distinct.length, ids: group.ids }] : []
  })
}
