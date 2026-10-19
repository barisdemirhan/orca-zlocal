import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/store'
import { watchProviderAccounts } from '@/runtime/runtime-provider-accounts-client'
import { toAgentHibernationRuntimeOwner } from '@/lib/agent-hibernation-runtime-owner'
import { resolveRuntimeOwnerForWorktree } from '@/lib/worktree-runtime-owner'
import type { RateLimitState } from '../../../../shared/rate-limit-types'
import type { AgentHubLists } from './agent-hub-lists'
import { agentHubIsApproval, agentHubStateSince } from './agent-hub-lists'
import {
  agentHubOrbFocusTargetCurrent,
  agentHubOrbTargetKey,
  pruneAgentHubOrbFocus,
  useAgentHubOrbFocusStore
} from './agent-hub-orb-focus-store'
import { agentHubInboxRequests, useAgentHubRequests } from './agent-hub-requests-store'
import { agentHubRequestHost } from './agent-hub-request-target'
import {
  agentHubOrbQuotaNotices,
  type AgentHubOrbFollowNotice
} from './agent-hub-orb-quota-notices'
import { useAgentHubOrbFollowStore } from './agent-hub-orb-follow-store'
import { paneTargetFromThread } from './agent-hub-pane-target'

/** Reuses host account streams and status facts; never starts a model, shell, or per-agent poller. */
export function useAgentHubOrbFollow(lists: AgentHubLists): void {
  const watches = useAgentHubOrbFocusStore((s) => s.watches)
  const requests = useAgentHubRequests()
  const localLimits = useAppStore((s) => s.rateLimits)
  const [remoteLimits, setRemoteLimits] = useState<ReadonlyMap<string, RateLimitState | null>>(
    new Map()
  )
  const [now, setNow] = useState(Date.now)
  const hosts = useMemo(
    () =>
      [
        ...new Set(
          [...watches.values()].flatMap((item) => {
            const owner = toAgentHibernationRuntimeOwner(
              resolveRuntimeOwnerForWorktree(useAppStore.getState(), item.target.worktree.id),
              [item.ptyId]
            )
            return owner.kind === 'runtime' ? [owner.environmentId] : []
          })
        )
      ].sort(),
    [watches]
  )
  useEffect(() => {
    let active = true
    const apply = (host: string, value: RateLimitState | null) => {
      if (active) {
        setRemoteLimits((previous) => new Map(previous).set(host, value))
      }
    }
    const subscriptions = hosts.map((host) =>
      watchProviderAccounts(
        { kind: 'environment', environmentId: host },
        {
          onSnapshot: (snapshot) => apply(host, snapshot.rateLimits),
          onError: () => apply(host, null),
          onClosedAfterSnapshot: () => apply(host, null)
        }
      )
    )
    return () => {
      active = false
      subscriptions.forEach((subscription) => subscription.close())
    }
  }, [hosts])
  useEffect(() => {
    const tick = () => {
      pruneAgentHubOrbFocus()
      setNow(Date.now())
    }
    const timer = setInterval(tick, 15_000)
    const unsubscribe = useAppStore.subscribe((state, previous) => {
      if (
        state.ptyIdsByTabId !== previous.ptyIdsByTabId ||
        state.tabsByWorktree !== previous.tabsByWorktree
      ) {
        pruneAgentHubOrbFocus()
      }
    })
    const unlock = (event: KeyboardEvent) => {
      const pinned = useAgentHubOrbFocusStore.getState().pinned
      if (!pinned) {
        return
      }
      const element = event.target instanceof HTMLElement ? event.target : null
      const pane = element?.closest<HTMLElement>('[data-terminal-tab-id]')
      const leaf = element?.closest<HTMLElement>('[data-leaf-id]')?.dataset.leafId
      const userTyping =
        pane?.dataset.terminalTabId === pinned.target.tab.id &&
        (!leaf || pinned.target.paneKey === `${pinned.target.tab.id}:${leaf}`) &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Enter')
      if (event.key === 'Escape' || userTyping) {
        useAgentHubOrbFocusStore.setState({ pinned: null })
      }
    }
    window.addEventListener('keydown', unlock)
    return () => {
      clearInterval(timer)
      unsubscribe()
      window.removeEventListener('keydown', unlock)
    }
  }, [])
  useEffect(() => {
    const state = useAppStore.getState()
    const current = [...watches.values()].filter((item) => agentHubOrbFocusTargetCurrent(item, now))
    const notices: AgentHubOrbFollowNotice[] = []
    for (const item of current) {
      const host = agentHubRequestHost(state, item.target.worktree)
      const handle = item.terminalHandle
      for (const pending of agentHubInboxRequests(requests)) {
        const request = pending.request
        if (
          pending.host !== host ||
          request.expiresAt <= now ||
          request.caller.paneKey !== item.target.paneKey ||
          !handle ||
          request.caller.terminalHandle !== handle
        ) {
          continue
        }
        const text =
          request.kind === 'ask' || request.kind === 'gate'
            ? request.question
            : request.kind === 'notify'
              ? request.text
              : 'An explicit permission request is waiting in Agent Hub.'
        notices.push({
          id: JSON.stringify(['request', host, request.requestId]),
          target: item.target,
          kind: 'decision',
          text: text.slice(0, 1800)
        })
      }
      for (const thread of lists.needsYou) {
        if (
          agentHubOrbTargetKey(paneTargetFromThread(thread, item.target.title)) !==
            agentHubOrbTargetKey(item.target) ||
          agentHubIsApproval(thread)
        ) {
          continue
        }
        notices.push({
          id: JSON.stringify(['status', handle, thread.paneKey, agentHubStateSince(thread)]),
          target: item.target,
          kind: 'decision',
          text: `${item.target.title}: a question or blocked step needs attention. Open the agent to review it.`
        })
      }
      const owner = toAgentHibernationRuntimeOwner(
        resolveRuntimeOwnerForWorktree(state, item.target.worktree.id),
        [item.ptyId]
      )
      const usage =
        owner.kind === 'runtime'
          ? (remoteLimits.get(owner.environmentId) ?? null)
          : owner.kind === 'non-runtime' && !item.target.worktree.hostId?.startsWith('ssh:')
            ? localLimits
            : null
      notices.push(
        ...agentHubOrbQuotaNotices(
          item.target,
          owner.kind === 'runtime' ? owner.environmentId : 'local',
          usage,
          now
        )
      )
    }
    useAgentHubOrbFollowStore.setState({
      notices: [...new Map(notices.map((notice) => [notice.id, notice])).values()].slice(0, 32)
    })
  }, [watches, requests, lists, localLimits, remoteLimits, now])
}
