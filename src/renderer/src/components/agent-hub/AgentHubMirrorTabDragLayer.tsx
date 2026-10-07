import { createContext, useContext, useMemo } from 'react'
import { DndContext, DragOverlay } from '@dnd-kit/core'
import { Ban } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { TabDragProvider } from '../tab-group/tab-drag-context'
import { useAgentHubMirrorTabDrag } from './use-agent-hub-mirror-tab-drag'
import type { MirrorStripDrop } from './agent-hub-mirror-drop-target'
import { currentMirrorDragEntry } from './agent-hub-mirror-drop-target'
import { useAgentHubTargetTitle } from './AgentHubMirrorTitle'
import type { AgentHubMirrorTabDrag } from './agent-hub-mirror-drag-data'

const MirrorTabDragContext = createContext<{
  active: AgentHubMirrorTabDrag | null
  drop: MirrorStripDrop | null
  enabled: boolean
}>({ active: null, drop: null, enabled: false })
export const useAgentHubMirrorDrag = () => useContext(MirrorTabDragContext)

function MirrorDragPreview({
  drag,
  allowed
}: {
  drag: AgentHubMirrorTabDrag
  allowed: boolean
}): React.JSX.Element | null {
  const entry = currentMirrorDragEntry(drag)
  return entry ? <MirrorDragLabel target={entry.target} allowed={allowed} /> : null
}
function MirrorDragLabel({
  target,
  allowed
}: {
  target: Parameters<typeof useAgentHubTargetTitle>[0]
  allowed: boolean
}): React.JSX.Element {
  const title = useAgentHubTargetTitle(target)
  return (
    <div
      data-allowed={allowed}
      data-agent-hub-drag-preview
      className="pointer-events-none flex h-8 max-w-48 items-center gap-2 rounded-md border border-border bg-popover px-3 text-xs text-popover-foreground shadow-floating data-[allowed=false]:cursor-not-allowed"
    >
      {allowed ? null : (
        <Ban
          className="size-3.5 shrink-0"
          aria-label={translate('agentHub.mirror.dropUnavailable', 'Cannot drop here')}
        />
      )}
      <span className="truncate">{title}</span>
    </div>
  )
}

export function AgentHubMirrorTabDragLayer({
  enabled,
  children
}: {
  enabled: boolean
  children: React.ReactNode
}): React.JSX.Element {
  const drag = useAgentHubMirrorTabDrag(enabled)
  const value = useMemo(
    () => ({ active: drag.active, drop: drag.drop, enabled }),
    [drag.active, drag.drop, enabled]
  )
  return (
    <MirrorTabDragContext.Provider value={value}>
      <TabDragProvider
        isTabDragActive={drag.active !== null}
        isTabDragActiveRef={drag.isTabDragActiveRef}
      >
        <DndContext
          sensors={drag.sensors}
          collisionDetection={drag.collisionDetection}
          onDragStart={drag.onDragStart}
          onDragMove={drag.onDragMove}
          onDragEnd={drag.onDragEnd}
          onDragCancel={drag.onDragCancel}
          onDragAbort={drag.onDragAbort}
          autoScroll={false}
        >
          <div ref={drag.setDragRootNode} className="contents">
            {children}
          </div>
          <DragOverlay dropAnimation={null} className="pointer-events-none">
            {drag.active ? (
              <MirrorDragPreview drag={drag.active} allowed={drag.drop !== null} />
            ) : null}
          </DragOverlay>
        </DndContext>
      </TabDragProvider>
    </MirrorTabDragContext.Provider>
  )
}
