import { useAppStore } from '@/store'
import { PopoverArrow, PopoverContent } from '@/components/ui/popover'
import { STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS } from '../status-bar/status-bar-context-menu-policy'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import { AgentHubPanel, type AgentHubOpenRequest } from './AgentHubPanel'
import type { AgentHubTab } from './agent-hub-keys'
import type { AgentHubLineage } from './agent-hub-lineage'
import type { AgentHubLists } from './agent-hub-lists'
import type { AgentHubLocation, AgentHubPaneTarget } from './agent-hub-pane-target'
import { useAgentHubTerminalTree } from './use-agent-hub-terminal-tree'

export type AgentHubPopoverRequest = { tab: AgentHubTab; paneKey: string | null; seq: number }

type AgentHubPopoverBodyProps = {
  lists: AgentHubLists
  lineage: AgentHubLineage
  threads: readonly AgentPaneThread[]
  includeShells: boolean
  request: AgentHubPopoverRequest
  rootRef: React.RefObject<HTMLDivElement | null>
  locationOf: (target: Pick<AgentHubPaneTarget, 'worktree' | 'repo'>) => AgentHubLocation
  onTabChange: (tab: AgentHubTab) => void
  onJump: (request: AgentHubOpenRequest) => void
  onOpen: (request: AgentHubOpenRequest) => void
  onPopout: (request: AgentHubOpenRequest) => void
  onClose: () => void
}

/** Mounted only while the popover is open: the tree subscribes to every tab write. */
function AgentHubPopoverBody({
  lists,
  lineage,
  threads,
  includeShells,
  request,
  rootRef,
  locationOf,
  onTabChange,
  onJump,
  onOpen,
  onPopout,
  onClose
}: AgentHubPopoverBodyProps): React.JSX.Element {
  const tree = useAgentHubTerminalTree(threads, includeShells, lineage.parentOf)
  const acknowledgeAgents = useAppStore((s) => s.acknowledgeAgents)
  const terminalCount = tree.reduce((total, group) => total + group.rowCount, 0)
  return (
    <AgentHubPanel
      // Why the seq key: a dock button or alert reopens on its own tab and card.
      key={request.seq}
      lists={lists}
      lineage={lineage}
      tree={tree}
      terminalCount={terminalCount}
      locationOf={locationOf}
      rootRef={rootRef}
      onJump={onJump}
      onOpen={onOpen}
      onPopout={onPopout}
      onMarkRead={acknowledgeAgents}
      onClose={onClose}
      initialTab={request.tab}
      onTabChange={onTabChange}
      initialPaneKey={request.paneKey}
    />
  )
}

function inMirrorLayer(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('[data-agent-hub-mirrors]') !== null
}

/** The hub's popover: the panel, anchored to the dock or the status-bar trigger. */
export function AgentHubPopoverContent({
  side,
  docked,
  anchorRef,
  restoreFocusRef,
  ...body
}: AgentHubPopoverBodyProps & {
  side: 'top' | 'bottom' | 'left' | 'right'
  docked: boolean
  /** The dock or trigger: its own buttons are not "outside" the popover. */
  anchorRef: React.RefObject<HTMLElement | null>
  /** What had focus before the hub opened; cleared when the hub hands focus elsewhere. */
  restoreFocusRef: React.RefObject<HTMLElement | null>
}): React.JSX.Element {
  return (
    <PopoverContent
      side={side}
      align={docked ? 'center' : 'end'}
      sideOffset={docked ? 12 : 8}
      {...STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS}
      collisionPadding={{ top: 8, bottom: 32, left: 8, right: 8 }}
      surface="panel"
      className="w-[456px] max-w-[calc(100vw-2rem)]"
      data-agent-hub-panel
      onOpenAutoFocus={(event) => {
        // Why: the panel root owns the arrow/number keys, so it takes focus, not the first button.
        event.preventDefault()
        body.rootRef.current?.focus()
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault()
        const previous = restoreFocusRef.current
        restoreFocusRef.current = null
        if (previous?.isConnected) {
          previous.focus()
        }
      }}
      onFocusOutside={(event) => {
        // Why: a mirror popped out from a row may take focus; the hub stays open for the next one.
        if (inMirrorLayer(event.target)) {
          event.preventDefault()
        }
      }}
      onInteractOutside={(event) => {
        // Why: the dock's own buttons switch tabs; treating them as "outside" would close first.
        if (event.target instanceof Node && anchorRef.current?.contains(event.target)) {
          event.preventDefault()
        } else if (inMirrorLayer(event.target)) {
          // A click on a mirror closes the hub and keeps the focus it just gave that terminal.
          restoreFocusRef.current = null
        }
      }}
      onEscapeKeyDown={(event) => {
        // Why: Esc in a non-empty filter clears it (see AgentHubTerminalTree) instead of closing.
        const active = document.activeElement
        if (
          active instanceof HTMLInputElement &&
          active.dataset.agentHubSearch !== undefined &&
          active.value
        ) {
          event.preventDefault()
        }
      }}
    >
      <AgentHubPopoverBody {...body} />
      <PopoverArrow width={14} height={7} />
    </PopoverContent>
  )
}
