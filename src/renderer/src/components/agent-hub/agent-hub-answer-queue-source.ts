import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import { buildSidebarHostOptions } from '../sidebar/worktree-list/controls/sidebar-host-options'
import { getHostDisplayLabelOverrides } from '../../../../shared/execution-host/host-setting-overrides'
import {
  getSettingsFocusedExecutionHostId,
  getWorktreeExecutionHostId,
  getExecutionHostLabel
} from '../../../../shared/execution-host/execution-host'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import {
  parseInteractivePrompt,
  type InteractivePromptCard
} from '../../../../shared/native-chat/input/native-chat-interactive-prompt'
import { sayNativeChatApprovalTranslated } from '../native-chat/prompts/native-chat-interactive-prompt'
import { agentHubCardKey } from './agent-hub-answered-cards'
import { agentHubStateSince } from './agent-hub-lists'
import {
  agentHubInboxRequests,
  agentHubRequestKey,
  useAgentHubRequests,
  type AgentHubInboxRequest
} from './agent-hub-requests-store'
import type { AgentHubAnswerQueueEntry } from './agent-hub-answer-queue'

type QueueEntryBase = AgentHubAnswerQueueEntry & { hostLabel: string }
export type AgentHubAnswerQueueItem = QueueEntryBase &
  (
    | {
        kind: 'pane'
        thread: AgentPaneThread
        card: NonNullable<InteractivePromptCard>
        cardKey: string
        stateSince: number
      }
    | { kind: 'request'; item: AgentHubInboxRequest }
  )

export function useAgentHubAnswerQueueSource(threads: readonly AgentPaneThread[]) {
  const state = useAppStore(
    useShallow((app) => ({
      agentStatusByPaneKey: app.agentStatusByPaneKey,
      repos: app.repos,
      settings: app.settings,
      sshTargetLabels: app.sshTargetLabels,
      sshConnectionStates: app.sshConnectionStates,
      runtimeEnvironments: app.runtimeEnvironments,
      runtimeStatusByEnvironmentId: app.runtimeStatusByEnvironmentId
    }))
  )
  const requests = useAgentHubRequests()
  return useMemo(() => {
    const hosts = buildSidebarHostOptions({
      ...state,
      hostLabelOverrides: getHostDisplayLabelOverrides(state.settings)
    })
    const byHost = new Map(hosts.map((host) => [host.id, host]))
    const verifiableHosts = new Set<string>(
      hosts
        .filter((host) => host.health === 'local' || host.health === 'available')
        .map((host) => host.id)
    )
    const unverifiableHosts = new Set<string>(
      hosts
        .filter((host) => host.health !== 'local' && host.health !== 'available')
        .map((host) => host.id)
    )
    const items: AgentHubAnswerQueueItem[] = []
    const defaultHost = getSettingsFocusedExecutionHostId(state.settings)
    for (const thread of threads) {
      const entry = state.agentStatusByPaneKey.get(thread.paneKey)
      const hostId = getWorktreeExecutionHostId(
        thread.worktree,
        thread.repo ?? undefined,
        defaultHost
      )
      if (hostId !== 'local' && !byHost.has(hostId)) {
        unverifiableHosts.add(hostId)
      }
      if (!entry || (entry.state !== 'waiting' && entry.state !== 'blocked')) {
        continue
      }
      const card = parseInteractivePrompt(
        entry.interactivePrompt,
        entry.toolName,
        thread.agentType,
        sayNativeChatApprovalTranslated
      )
      if (!card) {
        continue
      }
      const cardKey = agentHubCardKey(
        thread.paneKey,
        entry.stateStartedAt ?? agentHubStateSince(thread),
        entry.interactivePrompt
      )
      items.push({
        id: JSON.stringify([hostId, cardKey]),
        hostId,
        hostLabel: byHost.get(hostId)?.label ?? getExecutionHostLabel(hostId),
        arrivedAt: entry.updatedAt,
        approval: card.kind === 'approval',
        kind: 'pane',
        thread,
        card,
        cardKey,
        stateSince: entry.stateStartedAt
      })
    }
    for (const item of agentHubInboxRequests(requests)) {
      if (item.request.kind === 'notify') {
        continue
      }
      if (
        requests.get(item.host)?.answerStates.get(item.request.requestId)?.phase ===
        'answered-elsewhere'
      ) {
        continue
      }
      const hostId =
        item.host === 'local' ? defaultHost : (`runtime:${encodeURIComponent(item.host)}` as const)
      if (hostId !== 'local' && !byHost.has(hostId)) {
        unverifiableHosts.add(hostId)
      }
      items.push({
        id: agentHubRequestKey(item.host, item.request.requestId),
        arrivedAt: item.request.createdAt,
        hostId,
        hostLabel: byHost.get(hostId)?.label ?? getExecutionHostLabel(hostId),
        approval: item.request.kind === 'consent',
        kind: 'request',
        item
      })
    }
    return { items, unverifiableHosts, verifiableHosts }
  }, [state, threads, requests])
}
