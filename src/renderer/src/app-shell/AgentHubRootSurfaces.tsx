import { lazy, Suspense } from 'react'
import { useAppStore } from '../store'

const AgentHubShortcutInitialization = lazy(() =>
  import('../components/agent-hub/use-agent-hub-shortcut-initialization').then((module) => ({
    default: module.AgentHubShortcutInitialization
  }))
)
const AgentHubRequestConsumerSurface = lazy(() =>
  import('../components/agent-hub/AgentHubRequestConsumerSurface').then((module) => ({
    default: module.AgentHubRequestConsumerSurface
  }))
)

export function AgentHubRootSurfaces(): React.JSX.Element | null {
  const agentHubEnabled = useAppStore((s) => s.settings?.experimentalAgentHub === true)
  return agentHubEnabled ? (
    <Suspense fallback={null}>
      <AgentHubShortcutInitialization />
      <AgentHubRequestConsumerSurface />
    </Suspense>
  ) : null
}
