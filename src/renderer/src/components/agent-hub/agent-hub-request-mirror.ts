import type { AgentHubMirrorOutcome, AgentHubRequest } from '../../../../shared/agent-hub-requests'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import {
  openAgentHubMirrorInLayout,
  rearrangeAgentHubMirrorsByDefault
} from './agent-hub-floating-arrangement'
import { findAgentHubMirrorMembership } from './agent-hub-mirror-membership'
import {
  closeAgentHubMirror,
  closeAgentHubMirrorChip,
  minimizeAgentHubMirror,
  readAgentHubMirrors,
  restoreAgentHubMirror
} from './agent-hub-mirror-store'
import { agentHubMirrorTabCapReason } from './agent-hub-mirror-tab-actions'
import { addAgentHubMirrorTab } from './agent-hub-mirror-tab-operations'
import { findAgentHubRequestTarget } from './agent-hub-request-target'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

type Context = { threads: readonly AgentPaneThread[] }
type MirrorRequest = Extract<AgentHubRequest, { kind: 'mirror' }>

function addToMirrorCard(
  host: string,
  request: MirrorRequest,
  target: AgentHubPaneTarget,
  context: Context
): AgentHubMirrorOutcome {
  const state = useAppStore.getState()
  const mirrors = readAgentHubMirrors()
  const holder = findAgentHubRequestTarget(
    state,
    context.threads,
    host,
    request.into ?? request.caller
  )
  const card = holder ? findAgentHubMirrorMembership(mirrors, holder) : null
  if (!card) {
    if (request.into) {
      throw new Error(
        translate(
          'agentHub.requests.mirrorIntoMissing',
          'The --into terminal is not in an Agent Hub card. Run hub status to see the cards.'
        )
      )
    }
    openMirror(target)
    return 'opened'
  }
  const current = findAgentHubMirrorMembership(mirrors, target)
  if (current?.kind === 'tab') {
    if (current.window.id === card.window.id) {
      return 'already-there'
    }
    throw new Error(
      translate(
        'agentHub.requests.mirrorInOtherCard',
        'This terminal is already a tab in another card. Close that tab first.'
      )
    )
  }
  const result = addAgentHubMirrorTab(card.window.id, target, false)
  if (result.status !== 'changed') {
    throw new Error(
      result.status === 'tab-cap'
        ? agentHubMirrorTabCapReason()
        : translate(
            'agentHub.requests.mirrorAddFailed',
            'The terminal could not be added to the card ({{reason}}).',
            { reason: result.status }
          )
    )
  }
  return 'added'
}

function openMirror(target: AgentHubPaneTarget): void {
  const result = openAgentHubMirrorInLayout(target, false)
  if (result !== 'opened') {
    throw new Error(
      translate(
        'agentHub.requests.mirrorOpenFailed',
        'The mirror could not be opened ({{reason}}).',
        {
          reason: result
        }
      )
    )
  }
}

export function executeAgentHubMirror(
  host: string,
  request: MirrorRequest,
  context: Context
): AgentHubMirrorOutcome | null {
  const state = useAppStore.getState()
  const target = findAgentHubRequestTarget(state, context.threads, host, request.target)
  if (!target) {
    throw new Error(
      translate(
        'agentHub.requests.targetUnavailable',
        'This terminal is no longer available on its host.'
      )
    )
  }
  if (request.action === 'add') {
    return addToMirrorCard(host, request, target, context)
  }
  if (request.action === 'open') {
    openMirror(target)
    return 'opened'
  }
  const owner = findAgentHubMirrorMembership(readAgentHubMirrors(), target)
  if (!owner) {
    throw new Error(
      translate('agentHub.requests.mirrorUnavailable', 'This terminal has no mirror.')
    )
  }
  if (request.action === 'minimize') {
    minimizeAgentHubMirror(owner.window.id)
  } else if (request.action === 'restore') {
    restoreAgentHubMirror(owner.window.id, false)
  } else if (owner.presence === 'chip') {
    closeAgentHubMirrorChip(owner.window.id)
  } else {
    closeAgentHubMirror(owner.window.id)
  }
  rearrangeAgentHubMirrorsByDefault()
  return null
}
