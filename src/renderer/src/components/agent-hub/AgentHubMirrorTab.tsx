import { useDraggable } from '@dnd-kit/core'
import { AudioLines, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import type { AgentHubMirrorTab } from './agent-hub-mirror-membership'
import { agentHubIndicatorKind } from './agent-hub-lists'
import { agentHubStateWord } from './agent-hub-copy'
import { HubAvatar, HubStateIndicator } from './AgentHubStateMarks'
import { HubCrumb } from './AgentHubInlineLabels'
import { AgentHubMirrorTitle, useAgentHubTargetTitle } from './AgentHubMirrorTitle'
import { AgentHubMirrorSidebarReveal } from './AgentHubMirrorSidebarReveal'
import { AgentHubMirrorJumpButton } from './AgentHubMirrorJumpButton'
import type { AgentHubLocation } from './agent-hub-pane-target'
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
  location,
  closable,
  inputOwner,
  panelId,
  onSelect,
  onReveal,
  onClose
}: {
  windowId: string
  tab: AgentHubMirrorTab
  active: boolean
  thread: AgentPaneThread | null
  location: AgentHubLocation
  closable: boolean
  inputOwner: boolean
  panelId: string
  onSelect: (focusTerminal: boolean) => void
  onReveal: () => void
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
        data-single={!closable}
        className="group/tab relative flex min-w-64 max-w-80 basis-80 items-center gap-1 rounded-md border border-transparent px-1 data-[dragging=true]:opacity-50 data-[active=true]:border-border data-[active=true]:bg-background data-[single=true]:border-transparent data-[single=true]:bg-transparent"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              {...draggable.listeners}
              onPointerDown={(event) => {
                event.stopPropagation()
                if (event.target instanceof Element && event.target.closest('input, button')) {
                  return
                }
                if (
                  drag.enabled &&
                  event.button === 0 &&
                  claimAgentHubMirrorGesture('tab', event.pointerId)
                ) {
                  draggable.listeners?.onPointerDown?.(event)
                }
              }}
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
              onClick={(event) => {
                if (
                  event.detail < 2 &&
                  (!(event.target instanceof Element) || !event.target.closest('input'))
                ) {
                  onSelect(true)
                }
              }}
              onKeyDown={(event) => {
                if (event.key === ' ' && event.target === event.currentTarget) {
                  event.preventDefault()
                  onSelect(true)
                }
              }}
              className="flex h-9 min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-md px-1 text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground aria-selected:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="shrink-0">
                <HubStateIndicator kind={kind} />
              </span>
              <HubAvatar agentType={tab.target.agentType} kind={thread ? kind : null} />
              <div
                className="min-w-0 flex-1 text-[13px] leading-tight"
                onDoubleClick={() => onSelect(false)}
              >
                <AgentHubMirrorTitle target={tab.target} />
                <div className="flex items-center [&>span]:text-[11px]">
                  <HubCrumb location={location} />
                </div>
              </div>
              {inputOwner ? (
                <AudioLines
                  aria-label={translate('agentHub.mic.listeningTab', 'Dictation in this terminal')}
                  className="size-3 shrink-0"
                />
              ) : null}
            </div>
          </TooltipTrigger>
          <TooltipContent respectReducedMotion>{title}</TooltipContent>
        </Tooltip>
        <AgentHubMirrorSidebarReveal target={tab.target} />
        {closable ? <AgentHubMirrorJumpButton onReveal={onReveal} showShortcut={active} /> : null}
        {closable ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={translate(
                  'agentHub.mirror.closeTabNamed',
                  'Close mirror tab {{value0}}',
                  {
                    value0: title
                  }
                )}
                data-agent-hub-no-tab-drop
                onClick={onClose}
              >
                <X />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4} respectReducedMotion>
              {translate('agentHub.mirror.closeTab', 'Close tab')}
            </TooltipContent>
          </Tooltip>
        ) : null}
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
