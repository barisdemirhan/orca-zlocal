import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/store'
import { watchProviderAccounts } from '@/runtime/provider-accounts/observations/runtime-provider-accounts-client'
import type { RateLimitState } from '../../../../shared/agent-usage/rate-limits/rate-limit-types'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import type { AgentHubLists } from './agent-hub-lists'
import { useAgentHubRequests } from './agent-hub-requests-store'
import { useAgentHubOrbPanel } from './agent-hub-orb-panel-store'
import { useAgentHubOrbAwarenessStore } from './agent-hub-orb-awareness-store'
import { collectAgentHubOrbAwareness } from './agent-hub-orb-awareness'
import { resolveTerminalPtyOwner } from '@/lib/workspace/ownership/terminal-worktree-route'
import { toAgentHibernationRuntimeOwner } from '@/lib/agent-session/hibernation/agent-hibernation-runtime-owner'

/** Reads the existing host feeds; no agent-selection state or per-agent polling. */
export function useAgentHubOrbAwareness(
  threads: readonly AgentPaneThread[],
  lists: AgentHubLists
): void {
  const session = useAgentHubOrbPanel((state) => state.session)
  const requests = useAgentHubRequests()
  const localLimits = useAppStore((state) => state.rateLimits)
  const [remoteLimits, setRemoteLimits] = useState<ReadonlyMap<string, RateLimitState | null>>(
    new Map()
  )
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!session) {
      return
    }
    const timer = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(timer)
  }, [session])
  const hostsKey = useMemo(
    () =>
      JSON.stringify(
        session
          ? [
              ...new Set(
                threads.flatMap((thread) => {
                  const owner = toAgentHibernationRuntimeOwner(
                    resolveTerminalPtyOwner(useAppStore.getState(), thread.worktree.id),
                    []
                  )
                  return owner.kind === 'runtime' ? [owner.environmentId] : []
                })
              )
            ].sort()
          : []
      ),
    [threads, session]
  )
  useEffect(() => {
    let active = true
    const hosts: unknown = JSON.parse(hostsKey)
    const apply = (host: string, value: RateLimitState | null) => {
      if (active) {
        setRemoteLimits((previous) => new Map(previous).set(host, value))
      }
    }
    const subscriptions = Array.isArray(hosts)
      ? hosts
          .filter((host): host is string => typeof host === 'string')
          .map((host) =>
            watchProviderAccounts(
              { kind: 'environment', environmentId: host },
              {
                onSnapshot: (snapshot) => apply(host, snapshot.rateLimits),
                onError: () => apply(host, null),
                onClosedAfterSnapshot: () => apply(host, null)
              }
            )
          )
      : []
    return () => {
      active = false
      subscriptions.forEach((subscription) => subscription.close())
    }
  }, [hostsKey])
  useEffect(() => {
    const value = session
      ? collectAgentHubOrbAwareness({
          state: useAppStore.getState(),
          threads,
          lists,
          requests,
          remoteLimits,
          orbTabId: session.tabId,
          now: Date.now()
        })
      : { snapshot: null, targets: new Map(), display: new Map(), quota: [] }
    useAgentHubOrbAwarenessStore.setState(value)
  }, [session, threads, lists, requests, localLimits, remoteLimits, now])
}
