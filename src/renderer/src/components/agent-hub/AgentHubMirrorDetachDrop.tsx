import { translate } from '@/i18n/i18n'
import { agentHubWorkArea } from './agent-hub-floating-arrangement'
import { mirrorTabDetachGeometry } from './agent-hub-mirror-detach-geometry'
import type { AgentHubMirrorTabDrag } from './agent-hub-mirror-drag-data'
import type { MirrorTabDrop } from './agent-hub-mirror-drop-target'

export function AgentHubMirrorDetachDrop({
  active,
  drop
}: {
  active: AgentHubMirrorTabDrag | null
  drop: MirrorTabDrop | null
}): React.JSX.Element | null {
  if (!active) {
    return null
  }
  const area = agentHubWorkArea()
  const geometry =
    drop?.kind === 'detach' ? mirrorTabDetachGeometry(active.windowId, drop.point) : null
  return (
    <>
      <div
        data-agent-hub-new-mirror-drop
        className="pointer-events-auto fixed z-[48] rounded-md border border-dashed border-ring bg-popover px-4 py-3 text-xs text-popover-foreground shadow-floating"
        style={{
          left: area.left + area.width / 2,
          top: area.top + area.height - 52,
          transform: 'translateX(-50%)'
        }}
      >
        <span className="pointer-events-none">
          {translate('agentHub.mirror.openInNew', 'Open in new mirror')}
        </span>
      </div>
      {geometry ? (
        <div
          aria-hidden
          data-agent-hub-new-mirror-outline
          className="pointer-events-none fixed z-[47] rounded-xl border border-ring bg-background/20"
          style={{
            left: geometry.x,
            top: geometry.y,
            width: geometry.width,
            height: geometry.height
          }}
        />
      ) : null}
    </>
  )
}
