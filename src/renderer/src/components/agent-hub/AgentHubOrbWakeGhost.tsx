import { AgentHubOrbStage } from './AgentHubOrbStage'
import { useAgentHubOrbFlight } from './agent-hub-orb-flight-store'
import { useAgentHubOrbPanel } from './agent-hub-orb-panel-store'

/** The sphere before the host has opened and while it flies back after sleep; the session's own stage takes over. */
export function AgentHubOrbWakeGhost({ hidden }: { hidden: boolean }): React.JSX.Element | null {
  const session = useAgentHubOrbPanel((s) => s.session)
  const waking = useAgentHubOrbFlight((s) => s.waking)
  const flight = useAgentHubOrbFlight((s) => s.flight)
  if (session || hidden || (!waking && !flight)) {
    return null
  }
  return (
    <AgentHubOrbStage
      ghost
      embedded={false}
      compact={false}
      visible
      decorative
      phase={flight?.kind === 'return' ? 'idle' : 'connecting'}
      label=""
      request={null}
      requestVisible={false}
    />
  )
}
