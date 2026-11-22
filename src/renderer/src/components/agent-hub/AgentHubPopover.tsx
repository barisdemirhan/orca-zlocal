import { useAppStore } from '@/store'
import { PopoverArrow, PopoverContent } from '@/components/ui/popover'
import { normalizeAgentHubTerminalSort } from '../../../../shared/agent-hub-settings'
import { STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS } from '../status-bar/composition/status-bar-context-menu-policy'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import { AgentHubPanel, type AgentHubOpenRequest } from './AgentHubPanel'
import type { AgentHubPopoverOffsets } from './use-agent-hub-canvas-welcome'
import type { AgentHubTab } from './agent-hub-keys'
import type { AgentHubLineage } from './agent-hub-lineage'
import type { AgentHubLists } from './agent-hub-lists'
import type { AgentHubLocation, AgentHubPaneTarget } from './agent-hub-pane-target'
import { useAgentHubTerminalTree } from './use-agent-hub-terminal-tree'
import { useAgentHubTreeOrder } from './use-agent-hub-tree-order'
import type { AgentHubRequestBase } from '../../../../shared/agent-hub-requests'
import type { AgentHubRequestPresentation } from './agent-hub-request-presentation'

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
  onPopoutAll: (requests: AgentHubOpenRequest[]) => void
  onClose: () => void
  requestPresentationOf: (host: string, request: AgentHubRequestBase) => AgentHubRequestPresentation
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
  onPopoutAll,
  onClose,
  requestPresentationOf
}: AgentHubPopoverBodyProps): React.JSX.Element {
  const tree = useAgentHubTerminalTree(threads, includeShells, lineage.parentOf)
  const sortBy = useAppStore((s) => normalizeAgentHubTerminalSort(s.settings?.agentHubTerminalSort))
  const treeOrder = useAgentHubTreeOrder(tree, sortBy)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const acknowledgeAgents = useAppStore((s) => s.acknowledgeAgents)
  const terminalCount = tree.reduce((total, group) => total + group.rowCount, 0)
  return (
    <AgentHubPanel
      // Why the seq key: a dock button or alert reopens on its own tab and card.
      key={request.seq}
      lists={lists}
      lineage={lineage}
      tree={tree}
      treeOrder={treeOrder}
      onSortChange={(next) => void updateSettings({ agentHubTerminalSort: next })}
      terminalCount={terminalCount}
      locationOf={locationOf}
      rootRef={rootRef}
      onJump={onJump}
      onOpen={onOpen}
      onPopout={onPopout}
      onPopoutAll={onPopoutAll}
      onMarkRead={acknowledgeAgents}
      onClose={onClose}
      initialTab={request.tab}
      onTabChange={onTabChange}
      initialPaneKey={request.paneKey}
      requestPresentationOf={requestPresentationOf}
    />
  )
}

function inMirrorLayer(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('[data-agent-hub-mirrors]') !== null
}

// A confirmation the hub opened (stop agent, sleep) sits in its own dialog layer above the panel.
function inDialogLayer(target: EventTarget | null): boolean {
  return (
    target instanceof Element && target.closest('[role="dialog"], [role="alertdialog"]') !== null
  )
}

/** The hub's popover: the panel, anchored to the dock or the status-bar trigger. */
export function AgentHubPopoverContent({
  side,
  docked,
  centred,
  anchorRef,
  restoreFocusRef,
  ...body
}: AgentHubPopoverBodyProps & {
  side: 'top' | 'bottom' | 'left' | 'right'
  docked: boolean
  /** Set while the panel greets on an empty canvas: it sits mid-canvas, not on the dock. */
  centred: AgentHubPopoverOffsets | null
  /** The dock or trigger: its own buttons are not "outside" the popover. */
  anchorRef: React.RefObject<HTMLElement | null>
  /** What had focus before the hub opened; cleared when the hub hands focus elsewhere. */
  restoreFocusRef: React.RefObject<HTMLElement | null>
}): React.JSX.Element {
  return (
    <PopoverContent
      side={side}
      align={centred ? 'start' : docked ? 'center' : 'end'}
      sideOffset={centred?.sideOffset ?? (docked ? 12 : 8)}
      alignOffset={centred?.alignOffset}
      {...STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS}
      collisionPadding={{ top: 8, bottom: 32, left: 8, right: 8 }}
      surface="panel"
      className="w-152 max-w-[calc(100vw-2rem)]"
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
        // Why: a mirror popped out from a row may take focus (the floating terminal's preview
        // does); the hub stays open and keeps the keys, ready for the next one.
        if (inMirrorLayer(event.target)) {
          event.preventDefault()
          body.rootRef.current?.focus()
        } else if (inDialogLayer(event.target)) {
          // Why: answering the hub's own confirmation must not close the hub behind it.
          event.preventDefault()
        }
      }}
      onInteractOutside={(event) => {
        // Why: the dock's own buttons switch tabs; treating them as "outside" would close first.
        if (
          (event.target instanceof Node && anchorRef.current?.contains(event.target)) ||
          inDialogLayer(event.target)
        ) {
          event.preventDefault()
        } else if (inMirrorLayer(event.target)) {
          // A click on a mirror closes the hub and keeps the focus it just gave that terminal.
          restoreFocusRef.current = null
        }
      }}
      onEscapeKeyDown={(event) => {
        // Why: Esc in a non-empty filter clears it (see AgentHubTerminalTree) instead of closing.
        const active = document.activeElement
        // Why: Esc on a bot's page steps back to the Bots list first (see AgentHubBotPage).
        if (document.querySelector('[data-agent-hub-bot-page]')) {
          event.preventDefault()
        }
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
      {centred ? null : <PopoverArrow width={14} height={7} />}
    </PopoverContent>
  )
}
