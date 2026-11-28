import type { AgentHubCardRefusalCode } from '../../../../shared/agent-hub-requests'
import {
  agentHubMirrorSourceKey,
  agentHubMirrorWindows,
  type AgentHubMirrorState,
  type AgentHubMirrorTab,
  type AgentHubMirrorWindowState
} from './agent-hub-mirror-membership'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

export type AgentHubOwnCard = {
  window: AgentHubMirrorWindowState
  tab: AgentHubMirrorTab
  parked: boolean
}

function showsCaller(tab: AgentHubMirrorTab, callerKey: string): boolean {
  return (
    agentHubMirrorSourceKey(tab.target) === callerKey ||
    (tab.viewing !== undefined && agentHubMirrorSourceKey(tab.viewing) === callerKey)
  )
}

/** Only cards with a tab showing the caller's own terminal; this is the agent's security boundary. */
export function agentHubOwnCards(
  mirrors: AgentHubMirrorState,
  caller: AgentHubPaneTarget
): AgentHubOwnCard[] {
  const callerKey = agentHubMirrorSourceKey(caller)
  return agentHubMirrorWindows(mirrors).flatMap((window) => {
    const tab = window.tabs.find((entry) => showsCaller(entry, callerKey))
    return tab ? [{ window, tab, parked: !mirrors.windows.includes(window) }] : []
  })
}

export type AgentHubOwnCardChoice =
  | { card: AgentHubOwnCard }
  | {
      refusal: {
        code: Extract<AgentHubCardRefusalCode, 'no_card' | 'not_your_card'>
        cliText: string
      }
    }

/** `mirrorId` names a card; one that exists but does not show the caller is never described or acted on. */
export function chooseAgentHubOwnCard(
  mirrors: AgentHubMirrorState,
  caller: AgentHubPaneTarget | null,
  mirrorId?: string
): AgentHubOwnCardChoice {
  const own = caller ? agentHubOwnCards(mirrors, caller) : []
  if (mirrorId) {
    const chosen = own.find((card) => card.window.id === mirrorId)
    if (chosen) {
      return { card: chosen }
    }
    const exists = agentHubMirrorWindows(mirrors).some((window) => window.id === mirrorId)
    return exists
      ? {
          refusal: {
            code: 'not_your_card',
            cliText: 'That card shows another terminal. You can only use your own card.'
          }
        }
      : {
          refusal: { code: 'no_card', cliText: 'No card has that id. Run hub mirror list --mine.' }
        }
  }
  const card = own.find((entry) => !entry.parked) ?? own[0]
  return card
    ? { card }
    : { refusal: { code: 'no_card', cliText: 'No Agent Hub card shows this terminal.' } }
}
