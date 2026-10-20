import type {
  AgentHubPane,
  AgentHubRequest,
  AgentHubResponse,
  AgentHubStatus
} from '../../../../shared/agent-hub-requests'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import { openAgentHubCanvas, closeAgentHubCanvas } from './agent-hub-canvas-store'
import {
  arrangeAgentHubFloatingWindowsByDefault,
  arrangeAgentHubFloatingWindowsOnScreen,
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
import { addAgentHubMirrorTabWithFeedback } from './agent-hub-mirror-tab-actions'
import {
  agentHubRequestHost,
  agentHubTargetPane,
  findAgentHubRequestTarget
} from './agent-hub-request-target'
import { executeAgentHubPeek } from './agent-hub-request-peek'
import { readAgentHubRequests } from './agent-hub-requests-store'
import { paneTargetFromThread, type AgentHubPaneTarget } from './agent-hub-pane-target'
import type { AgentHubLists } from './agent-hub-lists'
import { useAgentHubOrbAwarenessStore } from './agent-hub-orb-awareness-store'

type Context = { threads: readonly AgentPaneThread[]; lists: AgentHubLists }

function readStatus(host: string, context: Context, includeAwareness: boolean): AgentHubStatus {
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
  return {
    mirrors: collect(
      mirrors.windows.flatMap((window) => window.tabs.map((tab) => tab.viewing ?? tab.target))
    ),
    parked: collect(
      mirrors.chips.flatMap((chip) => chip.window.tabs.map((tab) => tab.viewing ?? tab.target))
    ),
    waiting: [...waiting.values()],
    ...(awareness ? { orbAwareness: awareness } : {})
  }
}

function executeMirror(
  host: string,
  request: Extract<AgentHubRequest, { kind: 'mirror' }>,
  context: Context
): void {
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
  if (request.action === 'open' || request.action === 'add') {
    const caller = findAgentHubRequestTarget(state, context.threads, host, request.caller)
    const owner = caller ? findAgentHubMirrorMembership(readAgentHubMirrors(), caller) : null
    if (request.action === 'add' && owner?.presence === 'window') {
      const result = addAgentHubMirrorTabWithFeedback(owner.window.id, target, false)
      if (result.status !== 'changed') {
        throw new Error(
          translate(
            'agentHub.requests.mirrorAddFailed',
            'The terminal could not be added to the caller’s mirror ({{reason}}).',
            { reason: result.status }
          )
        )
      }
    } else {
      const result = openAgentHubMirrorInLayout(target, false)
      if (result !== 'opened') {
        throw new Error(
          translate(
            'agentHub.requests.mirrorOpenFailed',
            'The mirror could not be opened ({{reason}}).',
            { reason: result }
          )
        )
      }
    }
    return
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
        return null
      case 'mirror':
        executeMirror(host, request, context)
        break
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
      case 'status': {
        // Awareness spans every host; only the current Orb session may read it.
        const orbSessionId =
          request.caller.kind === 'orb' && request.caller.sessionId
            ? (await window.api.agentHub.orb.current().catch(() => null))?.sessionId
            : undefined
        const isOrb = Boolean(orbSessionId) && orbSessionId === request.caller.sessionId
        return { kind: 'status', ...readStatus(host, context, isOrb) }
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
