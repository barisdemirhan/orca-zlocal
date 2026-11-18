import type {
  AgentHubPane,
  AgentHubRequest,
  AgentHubResponse,
  AgentHubStatus
} from '../../../../shared/agent-hub-requests'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import { openAgentHubCanvas, closeAgentHubCanvas } from './agent-hub-canvas-store'
import {
  arrangeAgentHubFloatingWindowsByDefault,
  arrangeAgentHubFloatingWindowsOnScreen
} from './agent-hub-floating-arrangement'
import { agentHubMirrorWindows, findAgentHubMirrorMembership } from './agent-hub-mirror-membership'
import { readAgentHubMirrors } from './agent-hub-mirror-store'
import { executeAgentHubMirror } from './agent-hub-request-mirror'
import {
  agentHubRequestHost,
  agentHubTargetPane,
  findAgentHubRequestTarget
} from './agent-hub-request-target'
import {
  executeAgentHubPeek,
  executeAgentHubPeekControl,
  readAgentHubPeekStatus
} from './agent-hub-request-peek'
import { readAgentHubRequests } from './agent-hub-requests-store'
import { paneTargetFromThread, type AgentHubPaneTarget } from './agent-hub-pane-target'
import type { AgentHubLists } from './agent-hub-lists'
import { useAgentHubOrbAwarenessStore } from './agent-hub-orb-awareness-store'

type Context = { threads: readonly AgentPaneThread[]; lists: AgentHubLists }

function readStatus(
  host: string,
  request: AgentHubRequest,
  context: Context,
  includeAwareness: boolean
): AgentHubStatus {
  const state = useAppStore.getState()
  const collect = (targets: readonly AgentHubPaneTarget[]): AgentHubPane[] => {
    const panes = new Map<string, AgentHubPane>()
    for (const target of targets) {
      if (agentHubRequestHost(state, target.worktree) !== host) {
        continue
      }
      const pane = agentHubTargetPane(state, target)
      if (pane) {
        panes.set(pane.paneKey, pane)
      }
    }
    return [...panes.values()]
  }
  const mirrors = readAgentHubMirrors()
  const awareness = includeAwareness ? useAgentHubOrbAwarenessStore.getState().snapshot : null
  const stored = readAgentHubRequests().get(host)
  const waiting = new Map(
    collect(
      context.lists.needsYou.map((thread) => paneTargetFromThread(thread, thread.paneTitle))
    ).map((pane) => [pane.paneKey, pane])
  )
  for (const request of [
    ...(stored?.pendingGates.values() ?? []),
    ...(stored?.pendingAsks.values() ?? []),
    ...(stored?.pendingConsents.values() ?? [])
  ]) {
    waiting.set(request.target.paneKey, request.target)
  }
  const caller = findAgentHubRequestTarget(state, context.threads, host, request.caller)
  const cards = agentHubMirrorWindows(mirrors).flatMap((window) => {
    const tabs = collect(window.tabs.map((tab) => tab.viewing ?? tab.target))
    if (!tabs.length) {
      return []
    }
    const containsCaller = Boolean(
      caller && findAgentHubMirrorMembership(mirrors, caller)?.window.id === window.id
    )
    return [{ parked: !mirrors.windows.includes(window), containsCaller, tabs }]
  })
  return {
    mirrors: collect(
      mirrors.windows.flatMap((window) => window.tabs.map((tab) => tab.viewing ?? tab.target))
    ),
    parked: collect(
      mirrors.chips.flatMap((chip) => chip.window.tabs.map((tab) => tab.viewing ?? tab.target))
    ),
    waiting: [...waiting.values()],
    cards,
    peek: readAgentHubPeekStatus(host),
    ...(awareness ? { orbAwareness: awareness } : {})
  }
}

/** Card requests stay pending for the next phase; actions are acknowledged only after execution. */
export async function executeAgentHubRequest(
  host: string,
  request: AgentHubRequest,
  context: Context
): Promise<AgentHubResponse | null> {
  try {
    switch (request.kind) {
      case 'gate':
      case 'ask':
      case 'consent':
      case 'notify':
      case 'memory':
        return null
      case 'mirror': {
        const mirror = executeAgentHubMirror(host, request, context)
        return mirror ? { kind: 'ack', mirror } : { kind: 'ack' }
      }
      case 'arrange':
        if (!request.layout) {
          arrangeAgentHubFloatingWindowsByDefault()
        } else if (
          request.layout === 'grid' ||
          request.layout === 'columns' ||
          request.layout === 'rows'
        ) {
          arrangeAgentHubFloatingWindowsOnScreen(request.layout)
        } else {
          throw new Error(
            translate('agentHub.requests.invalidLayout', 'Choose the grid, columns or rows layout.')
          )
        }
        break
      case 'canvas':
        if (request.action === 'close') {
          closeAgentHubCanvas()
        } else if (useAppStore.getState().settings?.agentHubCanvas !== false) {
          openAgentHubCanvas(true)
        } else {
          throw new Error(
            translate(
              'agentHub.requests.canvasDisabled',
              'Enable the Agent Hub canvas in Settings to open it.'
            )
          )
        }
        break
      case 'peek': {
        const target = findAgentHubRequestTarget(
          useAppStore.getState(),
          context.threads,
          host,
          request.target
        )
        if (!target) {
          throw new Error(
            translate(
              'agentHub.requests.targetUnavailable',
              'This terminal is no longer available on its host.'
            )
          )
        }
        await executeAgentHubPeek(host, request.link, target)
        break
      }
      case 'peek-control':
        return { kind: 'ack', peek: executeAgentHubPeekControl(host, request.action) }
      case 'status': {
        // Awareness spans every host; only the current Orb session may read it.
        const orbSessionId =
          request.caller.kind === 'orb' && request.caller.sessionId
            ? (await window.api.agentHub.orb.current().catch(() => null))?.sessionId
            : undefined
        const isOrb = Boolean(orbSessionId) && orbSessionId === request.caller.sessionId
        return { kind: 'status', ...readStatus(host, request, context, isOrb) }
      }
      case 'presence': {
        const presence = await window.api.notifications.getDesktopPresence()
        if (!presence) {
          throw new Error(
            translate('agentHub.requests.presenceUnavailable', 'Desktop presence is unavailable.')
          )
        }
        return { kind: 'presence', ...presence }
      }
    }
    return { kind: 'ack' }
  } catch (error) {
    return {
      kind: 'error',
      code: 'invalid_argument',
      message: error instanceof Error ? error.message : String(error)
    }
  }
}
