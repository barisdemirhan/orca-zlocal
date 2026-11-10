import { useCallback, useEffect, useSyncExternalStore, useState } from 'react'
import { structuredAgentLabel } from '@/lib/agent-session/launch/structured-agent-session-launch-label'
import {
  loadHostStructuredAgents,
  readHostStructuredAgentsForRuntime,
  subscribeHostStructuredAgents
} from '@/runtime/native-chat/agent-catalogs/host-structured-agents'
import {
  preloadHostModelCatalogSnapshots,
  recordHostModelCatalogSnapshot,
  readHostModelCatalogSnapshot
} from '@/runtime/native-chat/model-catalogs/host-model-catalog-snapshots'
import { ensureLocalRuntimeCapabilities } from '@/runtime/hosts/capabilities/local-runtime-capabilities'
import { callStructuredAgentSession } from '@/runtime/native-chat/requests/structured-agent-session-call'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import type { AgentSessionModelCatalogResult } from '../../../../shared/agent-session/agent-session-wire'
import { structuredAgentSessionSeedCatalog } from '../../../../shared/agent-session/options/structured-agent-session-seed-catalog'
import { AGENT_SESSION_MODEL_CATALOG_SAVED_ONLY_RUNTIME_CAPABILITY } from '../../../../shared/agent-session/structured-agent-session-surface-capabilities'

const LOCAL = { kind: 'local' } as const
const readAgents = () => readHostStructuredAgentsForRuntime('local', null)

export function useAgentHubOrbOptions(agent: string) {
  const registered = useSyncExternalStore(subscribeHostStructuredAgents, readAgents, readAgents)
  const agents = [
    ...new Set(['claude', 'codex', ...(registered?.map((row) => row.agent) ?? [])])
  ].map((id) => ({ id, label: structuredAgentLabel(id) }))
  const [revision, refreshCatalog] = useState(0)
  const [loading, setLoading] = useState(false)
  const refreshModels = useCallback(() => refreshCatalog((value) => value + 1), [])
  const catalog = readHostModelCatalogSnapshot(LOCAL, agent, {
    newLaunch: true,
    seedsModel: true,
    worktree: FLOATING_TERMINAL_WORKTREE_ID
  })
  const models =
    catalog && catalog.origin !== 'unknown'
      ? catalog.models
      : agent === 'codex'
        ? []
        : structuredAgentSessionSeedCatalog(agent).models
  useEffect(() => {
    let stale = false
    setLoading(true)
    void ensureLocalRuntimeCapabilities()
      .then(async (capabilities) => {
        if (stale) {
          return
        }
        await loadHostStructuredAgents('local', capabilities, null)
        if (stale) {
          return
        }
        if (agent !== 'codex') {
          if (capabilities?.includes(AGENT_SESSION_MODEL_CATALOG_SAVED_ONLY_RUNTIME_CAPABILITY)) {
            await preloadHostModelCatalogSnapshots(LOCAL, [agent], { savedOnly: true })
          }
          return
        }
        const listed = await callStructuredAgentSession<AgentSessionModelCatalogResult>(
          LOCAL,
          'agentSession.modelCatalog',
          { agent, worktree: FLOATING_TERMINAL_WORKTREE_ID, waitForListing: true }
        )
        if (!stale) {
          recordHostModelCatalogSnapshot(LOCAL, agent, FLOATING_TERMINAL_WORKTREE_ID, listed)
        }
      })
      .catch(() => {
        // A failed read proves no new model; other agents retain their launch-safe aliases.
      })
      .finally(() => {
        if (!stale) {
          setLoading(false)
        }
      })
    return () => {
      stale = true
    }
  }, [agent, revision])
  return { agents, models, loading, refreshModels }
}
