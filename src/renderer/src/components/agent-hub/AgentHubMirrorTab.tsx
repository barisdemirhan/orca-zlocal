import { useDraggable } from '@dnd-kit/core'
import { AudioLines, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import type { AgentHubMirrorTab } from './agent-hub-mirror-membership'
import { agentHubIndicatorKind } from './agent-hub-lists'
import { agentHubStateWord } from './agent-hub-copy'
import { HubAvatar, HubStateIndicator } from './AgentHubAtoms'
import { useAgentHubTargetTitle } from './AgentHubMirrorTitle'
import { agentHubMirrorTabId } from './AgentHubMirrorTabStrip'
import { useAgentHubMirrorDrag } from './AgentHubMirrorTabDragLayer'
import { mirrorTabDragData } from './agent-hub-mirror-drag-data'
import { claimAgentHubMirrorGesture } from './agent-hub-mirror-gesture'
import { AgentHubMirrorTabMenu } from './AgentHubMirrorTabMenu'

export function AgentHubMirrorTab({
  windowId,
  tab,
  active,
  thread,
  inputOwner,
  panelId,
  onSelect,
  onClose
}: {
  windowId: string
  tab: AgentHubMirrorTab
  active: boolean
  thread: AgentPaneThread | null
  inputOwner: boolean
  panelId: string
  onSelect: (focusTerminal: boolean) => void
  onClose: () => void
}): React.JSX.Element {
  const title = useAgentHubTargetTitle(tab.target)
  const kind = thread ? agentHubIndicatorKind(thread) : 'idle'
  const drag = useAgentHubMirrorDrag()
  const draggable = useDraggable({
    id: `mirror-entry:${tab.id}`,
    data: mirrorTabDragData(windowId, tab),
    disabled: !drag.enabled
  })
  const insertion =
    drag.allowed &&
    drag.drop?.kind === 'strip' &&
    drag.drop.windowId === windowId &&
    drag.drop.entryId === tab.id
      ? drag.drop.side
      : null
  return (
    <AgentHubMirrorTabMenu windowId={windowId} entryId={tab.id} onClose={onClose}>
      <div
        ref={draggable.setNodeRef}
        data-agent-hub-tab-entry={tab.id}
        data-dragging={draggable.isDragging}
        data-active={active}
        className="group/tab relative flex min-w-40 max-w-48 basis-48 items-center gap-1 rounded-t-md border border-transparent px-1 data-[dragging=true]:opacity-50 data-[active=true]:border-border data-[active=true]:bg-background"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              {...draggable.listeners}
              onPointerDown={(event) => {
                event.stopPropagation()
                if (
                  drag.enabled &&
                  event.button === 0 &&
                  claimAgentHubMirrorGesture('tab', event.pointerId)
                ) {
                  draggable.listeners?.onPointerDown?.(event)
                }
              }}
              type="button"
              role="tab"
              id={agentHubMirrorTabId(tab.id)}
              aria-controls={panelId}
              aria-selected={active}
              aria-label={translate('agentHub.mirror.tabLabel', '{{value0}}, {{value1}}', {
                value0: title,
                value1: agentHubStateWord(thread)
              })}
              tabIndex={active ? 0 : -1}
              data-agent-hub-tab-id={tab.id}
              data-kind={kind}
              onClick={() => onSelect(true)}
              className="flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 text-xs text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground aria-selected:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="shrink-0">
                <HubStateIndicator kind={kind} />
              </span>
              <HubAvatar agentType={tab.target.agentType} kind={thread ? kind : null} />
              <span className="truncate">{title}</span>
              {inputOwner ? (
                <AudioLines
                  aria-label={translate('agentHub.mic.listeningTab', 'Dictation in this terminal')}
                  className="size-3 shrink-0"
                />
              ) : null}
            </button>
          </TooltipTrigger>
          <TooltipContent respectReducedMotion>{title}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={translate('agentHub.mirror.returnTab', 'Return {{value0}} to workspace', {
                value0: title
              })}
              data-agent-hub-no-tab-drop
              onClick={onClose}
            >
              <X />
            </Button>
          </TooltipTrigger>
          <TooltipContent respectReducedMotion>
            {translate('agentHub.mirror.returnToWorkspace', 'Return to workspace')}
          </TooltipContent>
        </Tooltip>
        {insertion ? (
          <span
            aria-hidden
            data-agent-hub-tab-insertion
            data-side={insertion}
            className="pointer-events-none absolute inset-y-0 left-0 w-0.5 bg-ring data-[side=right]:right-0 data-[side=right]:left-auto"
          />
        ) : null}
      </div>
    </AgentHubMirrorTabMenu>
  )
}
