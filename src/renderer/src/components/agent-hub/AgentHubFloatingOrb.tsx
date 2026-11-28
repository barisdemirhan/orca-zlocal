import { AgentHubOrbButton } from './AgentHubOrbButton'
import type { AgentHubOrbState } from './agent-hub-orb-state'
import { useAgentHubOrbPosition } from './use-agent-hub-orb-position'

export function AgentHubFloatingOrb({
  anchorRef,
  state,
  disabled,
  onOpen
}: {
  anchorRef: React.RefObject<HTMLDivElement | null>
  state: AgentHubOrbState
  disabled: boolean
  onOpen: (alternate?: boolean) => void
}): React.JSX.Element {
  const { position, onPointerDown, onClickCapture } = useAgentHubOrbPosition()
  return (
    <div
      ref={anchorRef}
      data-agent-hub-orb-floating
      className="fixed z-[45] size-12 touch-none select-none"
      style={{ left: position.x, top: position.y }}
      onPointerDown={onPointerDown}
      onClickCapture={onClickCapture}
    >
      <AgentHubOrbButton state={state} disabled={disabled} side="top" onOpen={onOpen} floating />
    </div>
  )
}
