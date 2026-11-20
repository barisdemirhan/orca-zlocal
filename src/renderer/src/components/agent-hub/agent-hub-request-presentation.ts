import { translate } from '@/i18n/i18n'
import type { AppState } from '@/store/types'
import type {
  AgentHubOperation,
  AgentHubRequestBase,
  AgentHubMirrorAction
} from '../../../../shared/agent-hub-requests'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import { findAgentHubRequestTarget } from './agent-hub-request-target'
import type { AgentHubLocation, AgentHubPaneTarget } from './agent-hub-pane-target'

export type AgentHubRequestPresentation = {
  title: string
  targetTitle: string
  location: AgentHubLocation
  target: AgentHubPaneTarget | null
  related?: {
    title: string
    agentType: string | null
    location: AgentHubLocation
  }
}

export function agentHubRequestPresentation(
  state: AppState,
  threads: readonly AgentPaneThread[],
  host: string,
  request: AgentHubRequestBase,
  locationOf: (target: AgentHubPaneTarget) => AgentHubLocation
): AgentHubRequestPresentation {
  const caller = findAgentHubRequestTarget(state, threads, host, request.caller)
  const target = findAgentHubRequestTarget(state, threads, host, request.target)
  const title = request.caller.title ?? caller?.title ?? request.caller.terminalHandle
  return {
    title,
    targetTitle: target?.title ?? request.target.terminalHandle,
    target: caller,
    ...(request.caller.kind === 'orb' && target
      ? {
          related: {
            title: target.title,
            agentType: target.agentType,
            location: locationOf(target)
          }
        }
      : {}),
    location: caller
      ? locationOf(caller)
      : {
          group: null,
          project: title,
          workspace: null,
          host:
            host === 'local'
              ? undefined
              : (state.runtimeEnvironments.find((environment) => environment.id === host)?.name ??
                host)
        }
  }
}

export function agentHubConsentAction(operation: AgentHubOperation, title: string): string {
  switch (operation.kind) {
    case 'mirror':
      return mirrorActionText(operation.action, title)
    case 'peek':
      return translate('agentHub.requests.peekLink', 'peek at {{link}}', { link: operation.link })
    case 'peek-control':
      return operation.action === 'close'
        ? translate('agentHub.requests.closePeek', 'close Peek')
        : translate('agentHub.requests.goBackInPeek', 'go back in Peek')
    case 'arrange':
      return translate('agentHub.requests.arrangeMirrors', 'arrange mirrors')
    case 'canvas':
      return operation.action === 'open'
        ? translate('agentHub.requests.openCanvas', 'open the canvas')
        : translate('agentHub.requests.closeCanvas', 'close the canvas')
  }
}

function mirrorActionText(action: AgentHubMirrorAction, title: string): string {
  switch (action) {
    case 'open':
    case 'add':
      return translate('agentHub.requests.openMirror', 'open the mirror of {{title}}', {
        title
      })
    case 'minimize':
      return translate('agentHub.requests.minimizeMirror', 'minimize the mirror of {{title}}', {
        title
      })
    case 'restore':
      return translate('agentHub.requests.restoreMirror', 'restore the mirror of {{title}}', {
        title
      })
    case 'close':
      return translate('agentHub.requests.closeMirror', 'close the mirror of {{title}}', {
        title
      })
  }
}
