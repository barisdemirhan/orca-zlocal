import { useEffect, useSyncExternalStore, useState } from 'react'
import { structuredAgentLabel } from '@/lib/structured-agent-session-launch-label'
import {
  loadHostStructuredAgents,
  readHostStructuredAgentsForRuntime,
  subscribeHostStructuredAgents
} from '@/runtime/host-structured-agents'
import {
  preloadHostModelCatalogSnapshots,
  readHostModelCatalogSnapshot
} from '@/runtime/host-model-catalog-snapshots'
import { ensureLocalRuntimeCapabilities } from '@/runtime/local-runtime-capabilities'
import { AGENT_SESSION_MODEL_CATALOG_SAVED_ONLY_RUNTIME_CAPABILITY } from '../../../../shared/structured-agent-session-surface-capabilities'
import { structuredAgentSessionSeedCatalog } from '../../../../shared/structured-agent-session-seed-catalog'

const LOCAL = { kind: 'local' } as const
const readAgents = () => readHostStructuredAgentsForRuntime('local', null)

export function useAgentHubOrbOptions(agent: string) {
  const registered = useSyncExternalStore(subscribeHostStructuredAgents, readAgents, readAgents)
  const agents = [
    ...new Set(['claude', 'codex', ...(registered?.map((row) => row.agent) ?? [])])
  ].map((id) => ({ id, label: structuredAgentLabel(id) }))
  const [, refreshCatalog] = useState(0)
  const catalog = readHostModelCatalogSnapshot(LOCAL, agent, { newLaunch: true, seedsModel: true })
  const models =
    catalog && catalog.origin !== 'unknown'
      ? catalog.models
      : structuredAgentSessionSeedCatalog(agent).models
  useEffect(() => {
    let stale = false
    void ensureLocalRuntimeCapabilities()
      .then(async (capabilities) => {
        if (stale) {
          return
        }
        await loadHostStructuredAgents('local', capabilities, null)
        if (
          stale ||
          !capabilities?.includes(AGENT_SESSION_MODEL_CATALOG_SAVED_ONLY_RUNTIME_CAPABILITY)
        ) {
          return
        }
        await preloadHostModelCatalogSnapshots(LOCAL, [agent], { savedOnly: true })
        if (!stale) {
          refreshCatalog((revision) => revision + 1)
        }
      })
      .catch(() => {
        // Older or unavailable hosts keep the seed catalog.
      })
    return () => {
      stale = true
    }
  }, [agent])
  return { agents, models }
}
