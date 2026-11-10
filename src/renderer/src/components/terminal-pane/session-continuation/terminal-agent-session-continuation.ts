import { toast } from 'sonner'
import type { ManagedPane } from '@/lib/pane-manager/pane-manager-types'
import {
  buildAgentSessionContinuationPrompt,
  resolveAgentSessionContinuationTranscriptPath,
  type AgentSessionContinuationRequest
} from '@/lib/agent-session-continuation'
import { useAppStore } from '@/store/index'
import { makePaneKey } from '../../../../../shared/workspace-layout/stable-pane-id'
import { isTuiAgent } from '../../../../../shared/agent-launch/catalog/tui-agent-config'
import type { TuiAgent } from '../../../../../shared/agent-launch/catalog/tui-agent'
import { translate } from '@/i18n/i18n'
import { agentHubMirrorWindowIdOf } from '@/components/agent-hub/agent-hub-mirror-element'

type PrepareAgentSessionContinuationFromPaneArgs = {
  pane: ManagedPane
  tabId: string
  worktreeId: string
  groupId: string | null
  workspacePath: string
  initialCwd: string
}

export function canContinueAgentSessionInNewSession(
  sourceAgent: string | null | undefined
): boolean {
  return isTuiAgent(sourceAgent)
}

function resolveSourceAgent(args: {
  tabId: string
  worktreeId: string
  pane: ManagedPane
}): TuiAgent | null {
  const state = useAppStore.getState()
  const paneAgent = state.agentStatusByPaneKey[makePaneKey(args.tabId, args.pane.leafId)]?.agentType
  if (isTuiAgent(paneAgent)) {
    return paneAgent
  }
  const tabAgent = state.tabsByWorktree[args.worktreeId]?.find(
    (tab) => tab.id === args.tabId
  )?.launchAgent
  return isTuiAgent(tabAgent) ? tabAgent : null
}

export function prepareAgentSessionContinuationFromPane({
  pane,
  tabId,
  worktreeId,
  groupId,
  workspacePath,
  initialCwd
}: PrepareAgentSessionContinuationFromPaneArgs): AgentSessionContinuationRequest | null {
  const state = useAppStore.getState()
  const paneKey = makePaneKey(tabId, pane.leafId)
  const status = state.agentStatusByPaneKey[paneKey]
  const sourceAgent = resolveSourceAgent({ pane, tabId, worktreeId })
  const transcriptPath = resolveAgentSessionContinuationTranscriptPath({
    sourceAgent,
    transcriptPath: status?.providerSession?.transcriptPath
  })
  const capturedText = transcriptPath ? '' : pane.serializeAddon.serialize({ scrollback: 800 })
  const source = {
    // Why: prefer the same-host transcript so opening the dialog does not serialize large scrollback.
    capturedText,
    sourceAgent,
    sourceLabel: paneKey,
    sourceWorkingDirectory: initialCwd || workspacePath,
    transcriptPath,
    lastPrompt: status?.prompt,
    lastAssistantMessage: status?.lastAssistantMessage
  }
  if (!buildAgentSessionContinuationPrompt(source, 'focused')) {
    toast.error(
      translate(
        'components.agentSessionContinuation.noContext',
        'No session context is available to continue in a new session.'
      )
    )
    pane.terminal.focus()
    return null
  }

  const mirrorWindowId = agentHubMirrorWindowIdOf(pane.container)
  return {
    source,
    worktreeId,
    groupId,
    // Why: where the new session opens is a mirror question; the workspace keeps jumping to it.
    ...(mirrorWindowId ? { mirrorSource: { windowId: mirrorWindowId, tabId } } : {}),
    workspacePath,
    initialCwd: initialCwd || workspacePath,
    launchSource: 'terminal_context_menu'
  }
}
