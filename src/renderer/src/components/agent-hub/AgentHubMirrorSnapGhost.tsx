import { createPortal } from 'react-dom'
import type { AgentHubMirrorGeometry } from './agent-hub-mirror-geometry'

export type AgentHubMirrorSnapPreview = {
  target: AgentHubMirrorGeometry
  neighbours: readonly AgentHubMirrorGeometry[]
}

const CORNERS = ['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'] as const

/** Where a dragged or resized mirror will land on the canvas, and where the windows it displaces go. */
export function AgentHubMirrorSnapGhost({
  preview,
  zIndex
}: {
  preview: AgentHubMirrorSnapPreview
  zIndex: number
}): React.JSX.Element {
  return createPortal(
    <div aria-hidden className="pointer-events-none fixed inset-0" style={{ zIndex }}>
      {preview.neighbours.map((box) => (
        <div
          key={`${box.x}:${box.y}:${box.width}:${box.height}`}
          style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
          className="fixed rounded-xl border border-dashed border-primary/30 transition-[left,top,width,height] duration-150 motion-reduce:transition-none"
        />
      ))}
      <div
        style={{
          left: preview.target.x,
          top: preview.target.y,
          width: preview.target.width,
          height: preview.target.height
        }}
        className="fixed rounded-xl border-2 border-primary/60"
      >
        {CORNERS.map((corner) => (
          <span
            key={corner}
            className={`absolute size-1.5 rounded-full bg-primary ${corner}`}
            style={{
              translate: `${corner.includes('right') ? '50%' : '-50%'} ${corner.includes('bottom') ? '50%' : '-50%'}`
            }}
          />
        ))}
      </div>
    </div>,
    document.body
  )
}
