import { useMemo } from 'react'
import { useNow } from '@/lib/window-activity/use-now'
import { useAgentPaneThreads } from '../activity/threads/use-agent-pane-threads'
import { buildAgentHubLineage } from './agent-hub-lineage'
import { useAgentHubLists } from './use-agent-hub-lists'
import { useAgentHubPreferences } from './use-agent-hub-settings'
import { useAgentHubRequestConsumer } from './use-agent-hub-request-consumer'

/** The desktop consumer stays mounted when the status bar is hidden. */
export function AgentHubRequestConsumerSurface(): null {
  const preferences = useAgentHubPreferences()
  const now = useNow(60_000)
  const { allThreads: threads } = useAgentPaneThreads({
    query: '',
    readFilter: 'all',
    groupBy: 'none',
    selectedPaneKey: null,
    showChildAgents: true
  })
  const lineage = useMemo(() => buildAgentHubLineage(threads, now), [threads, now])
  const lists = useAgentHubLists(threads, now, preferences.finishedClearMinutes * 60_000, lineage)
  useAgentHubRequestConsumer(threads, lists)
  return null
}
