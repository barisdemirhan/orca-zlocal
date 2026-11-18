import { useDraggable } from '@dnd-kit/core'
import { useState } from 'react'
import { AudioLines, ChevronRight, Pin, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import type { AgentHubMirrorTab } from './agent-hub-mirror-membership'
import { agentHubIndicatorKind } from './agent-hub-lists'
import { agentHubStateWord } from './agent-hub-copy'
import { HubAvatar } from './AgentHubStateMarks'
import { HubCrumb } from './AgentHubInlineLabels'
import { AgentHubMirrorTitle, useAgentHubTargetTitle } from './AgentHubMirrorTitle'
import {
  canRevealAgentHubTargetInSidebar,
  revealAgentHubTargetInSidebar
} from './agent-hub-sidebar-reveal'
import type { AgentHubLocation } from './agent-hub-pane-target'
import { agentHubMirrorTabId } from './AgentHubMirrorTabStrip'
import { useAgentHubMirrorDrag } from './AgentHubMirrorTabDragLayer'
import { mirrorTabDragData } from './agent-hub-mirror-drag-data'
import { claimAgentHubMirrorGesture } from './agent-hub-mirror-gesture'
import { AgentHubMirrorTabMenu } from './AgentHubMirrorTabMenu'
import { AgentHubThreadHoverCard } from './AgentHubThreadHoverCard'
import { useAgentHubProgress } from './use-agent-hub-progress'
import { useAgentHubSleepingTargetTest } from './agent-hub-pane-sleep'
import { closeAgentHubAgent } from './agent-hub-close-agent'
import {
  showAgentHubFamilyBar,
  toggleAgentHubFamilyBar,
  useAgentHubFamilyBarShown
} from './agent-hub-family-bar'

export function AgentHubMirrorTab({
  windowId,
  tab,
  active,
  thread,
  location,
  familyRoot,
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
  /** Top dispatcher's pane when this tab's pane belongs to an orchestration family. */
  familyRoot: string | null
  closable: boolean
  inputOwner: boolean
  panelId: string
  onSelect: (focusTerminal: boolean) => void
  onReveal: () => void
  onClose: () => void
}): React.JSX.Element {
  const title = useAgentHubTargetTitle(tab.target)
  const progress = useAgentHubProgress(tab.viewing ?? tab.target)
  const kind = thread ? agentHubIndicatorKind(thread) : 'idle'
  const sleeping = useAgentHubSleepingTargetTest()(tab.target)
  const drag = useAgentHubMirrorDrag()
  const familyBarShown = useAgentHubFamilyBarShown(familyRoot)
  const [editing, setEditing] = useState(false)
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
  // An inactive tab's workers bar is not on screen, whatever its family's setting.
  const familyBarOpen = active && familyBarShown
  const familyLabel = familyBarOpen
    ? translate('agentHub.mirror.hideWorkers', 'Hide the workers bar')
    : translate('agentHub.mirror.showWorkers', 'Show the workers bar')
  // One set of actions for the hover card and the context menu, so the two cannot drift.
  const actions = {
    onShowInSidebar: canRevealAgentHubTargetInSidebar(tab.target)
      ? () => revealAgentHubTargetInSidebar(tab.target)
      : undefined,
    // A window's only tab has Jump in the window header.
    onJump: closable ? onReveal : undefined
  }
  const tabNode = (
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
        value1: sleeping ? translate('agentHub.sleep.group', 'Sleeping') : agentHubStateWord(thread)
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
      className="flex h-9 min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-md px-1 text-muted-foreground outline-none group-hover/tab:text-accent-foreground aria-selected:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      {tab.isPinned ? <Pin aria-hidden className="size-3 shrink-0" /> : null}
      <HubAvatar agentType={tab.target.agentType} kind={thread ? kind : null} sleeping={sleeping} />
      <div
        data-sleeping={sleeping}
        className="min-w-0 flex-1 text-[13px] leading-tight data-[sleeping=true]:opacity-60"
        onDoubleClick={() => onSelect(false)}
      >
        <AgentHubMirrorTitle target={tab.target} onEditingChange={setEditing} />
        <div className="flex min-w-0 items-center [&>span]:text-[11px]">
          {progress ? (
            <span className="truncate text-muted-foreground">{progress}</span>
          ) : (
            <HubCrumb location={location} />
          )}
        </div>
      </div>
      {inputOwner ? (
        <AudioLines
          aria-label={translate('agentHub.mic.listeningTab', 'Dictation in this terminal')}
          className="size-3 shrink-0"
        />
      ) : null}
    </div>
  )
  return (
    <AgentHubMirrorTabMenu
      windowId={windowId}
      entryId={tab.id}
      target={closable ? (tab.viewing ?? tab.target) : undefined}
      switchTarget={tab.viewing ?? tab.target}
      onReveal={actions.onJump}
      onShowInSidebar={actions.onShowInSidebar}
      onClose={onClose}
      isAgent={thread !== null || tab.target.agentType !== null}
      onCloseAgent={
        closable
          ? () =>
              closeAgentHubAgent(
                { ...tab.target, agentType: thread?.agentType ?? tab.target.agentType },
                kind
              )
          : undefined
      }
    >
      <div
        ref={draggable.setNodeRef}
        data-agent-hub-tab-entry={tab.id}
        data-dragging={draggable.isDragging}
        data-active={active}
        data-single={!closable}
        data-pinned={tab.isPinned === true}
        className="group/tab relative flex min-w-60 max-w-80 basis-80 items-center gap-1 rounded-md border border-transparent px-1 hover:bg-accent data-[dragging=true]:opacity-50 data-[active=true]:border-border data-[active=true]:bg-background data-[single=true]:border-transparent data-[single=true]:bg-transparent data-[single=true]:hover:bg-accent"
      >
        {familyRoot ? (
          // Why a sibling of the tab: a button inside role="tab" is invalid nesting.
          <button
            type="button"
            aria-label={familyLabel}
            title={familyLabel}
            aria-expanded={familyBarOpen}
            data-agent-hub-no-tab-drop
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => {
              if (active) {
                toggleAgentHubFamilyBar(familyRoot)
              } else {
                onSelect(false)
                showAgentHubFamilyBar(familyRoot)
              }
            }}
            className="grid size-4 shrink-0 place-items-center rounded text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight
              data-open={familyBarOpen}
              className="size-3 transition-transform duration-150 data-[open=true]:rotate-90"
            />
          </button>
        ) : null}
        <AgentHubThreadHoverCard
          thread={thread}
          target={{ title, agentType: tab.target.agentType }}
          location={location}
          actions={{ ...actions, showJumpShortcut: active }}
          suppressed={drag.active !== null || editing}
        >
          {tabNode}
        </AgentHubThreadHoverCard>
        {closable && !tab.isPinned ? (
          // Why a wrapper: the button keeps its primitive look; only its visibility follows the tab.
          <span className="flex shrink-0 opacity-0 transition-opacity duration-100 group-hover/tab:opacity-100 group-data-[active=true]/tab:opacity-100 focus-within:opacity-100">
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
          </span>
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
