import type {
  AgentHubCardInfo,
  AgentHubCardOperation,
  AgentHubCardResult
} from '../../../../shared/agent-hub-requests'
import { agentHubSurfaceSetting } from '../../../../shared/agent-hub-surface-settings'
import { isFolderRepo } from '../../../../shared/repository/repo-kind'
import { useAppStore } from '@/store'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import { agentHubMirrorSourceKey } from './agent-hub-mirror-membership'
import {
  agentMayUseCard,
  openAgentHubMirrorDrawer,
  readAgentHubMirrorDrawer,
  readAgentHubMirrorEvents,
  readAgentHubMirrorStripPref
} from './agent-hub-mirror-drawer-store'
import { readAgentHubMirrors } from './agent-hub-mirror-store'
import {
  agentHubOwnCards,
  chooseAgentHubOwnCard,
  type AgentHubOwnCard
} from './agent-hub-own-cards'
import { findAgentHubRequestTarget } from './agent-hub-request-target'
import type { AgentHubRequest } from '../../../../shared/agent-hub-requests'

type CardRequest = Extract<AgentHubRequest, { kind: 'card' }>

function cardInfo(
  card: AgentHubOwnCard,
  sourceKey: string,
  stripDefault: boolean
): AgentHubCardInfo {
  return {
    mirrorId: card.window.id,
    tabId: card.tab.id,
    visible: !card.parked,
    parked: card.parked,
    drawer: readAgentHubMirrorDrawer(sourceKey),
    strip: readAgentHubMirrorStripPref(sourceKey) ?? stripDefault,
    agentMayUse: agentMayUseCard(sourceKey)
  }
}

function refusal(
  code: Extract<AgentHubCardResult, { action: 'refused' }>['code'],
  message: string
): AgentHubCardResult {
  return { action: 'refused', code, message }
}

export function executeAgentHubCard(
  host: string,
  request: CardRequest,
  threads: readonly AgentPaneThread[]
): AgentHubCardResult {
  const state = useAppStore.getState()
  const operation: AgentHubCardOperation = request.card
  const caller = findAgentHubRequestTarget(state, threads, host, request.caller)
  const mirrors = readAgentHubMirrors()
  const choice = chooseAgentHubOwnCard(
    mirrors,
    caller,
    operation.action === 'show' ? operation.mirrorId : undefined
  )
  const strip = agentHubSurfaceSetting(state.settings, 'agentHubMirrorWorkStrip')
  const sourceKey = caller ? agentHubMirrorSourceKey(caller) : ''
  if (operation.action === 'list') {
    const cards = caller ? agentHubOwnCards(mirrors, caller) : []
    return { action: 'list', cards: cards.map((card) => cardInfo(card, sourceKey, strip)) }
  }
  if ('refusal' in choice) {
    return refusal(choice.refusal.code, choice.refusal.cliText)
  }
  if (!agentMayUseCard(sourceKey)) {
    return refusal('card_use_off', 'The person turned off agent use for this card.')
  }
  if (operation.action === 'events') {
    const events = readAgentHubMirrorEvents(sourceKey, operation.since).slice(0, 100)
    return {
      action: 'events',
      events,
      cursor: events.at(-1)?.seq ?? operation.since
    }
  }
  const folderOnly = operation.drawer === 'changes' || operation.drawer === 'pr'
  if (folderOnly && caller?.repo && isFolderRepo(caller.repo)) {
    return refusal('not_available', 'This is a folder workspace, so it has no changes or PR.')
  }
  const outcome = openAgentHubMirrorDrawer(sourceKey, operation.drawer, 'agent')
  if (outcome === 'closed-by-user') {
    return refusal(
      'drawer_closed_by_user',
      'The person closed this drawer during this turn, so it stays closed.'
    )
  }
  if (outcome === 'not-available') {
    return refusal('not_available', `The ${operation.drawer} drawer has nothing to show here.`)
  }
  return { action: 'show', card: cardInfo(choice.card, sourceKey, strip), drawer: operation.drawer }
}
