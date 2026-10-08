import { Fragment } from 'react'
import { ArrowUpRight, ChevronRight, Workflow } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { AgentIcon } from '@/lib/agent-catalog'
import { agentTypeToIconAgent } from '@/lib/agent-status'
import { activityThreadRowCopy } from '../activity/activity-thread-presentation'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import { HubStateIndicator } from './AgentHubStateMarks'
import { agentHubIndicatorKind } from './agent-hub-lists'
import type { AgentHubFamilyNode, AgentHubMirrorFamily } from './agent-hub-mirror-family'
import type { AgentHubLocation } from './agent-hub-pane-target'
import { AgentHubThreadHoverCard, type AgentHubThreadCardActions } from './AgentHubThreadHoverCard'

function FamilyButton({
  thread,
  level,
  depth = 0,
  active,
  location,
  actions,
  onSelect,
  children
}: {
  thread: AgentPaneThread
  level: 'dispatcher' | 'worker'
  /** Nesting of a worker row, announced as its tree level. */
  depth?: number
  active: boolean
  location: AgentHubLocation
  actions: AgentHubThreadCardActions
  onSelect: (thread: AgentPaneThread) => void
  children?: React.ReactNode
}): React.JSX.Element {
  const title = activityThreadRowCopy(thread).taskTitle
  const agent = agentTypeToIconAgent(thread.agentType)
  return (
    <span className="flex shrink-0 items-center">
      <AgentHubThreadHoverCard thread={thread} location={location} actions={actions}>
        <button
          type="button"
          role={level === 'worker' ? 'treeitem' : undefined}
          aria-level={level === 'worker' ? depth + 1 : undefined}
          aria-selected={level === 'worker' ? active : undefined}
          aria-current={level === 'dispatcher' && active ? 'page' : undefined}
          data-level={level}
          data-active={active}
          onClick={() => onSelect(thread)}
          className="flex h-6 max-w-55 shrink-0 items-center gap-1.5 rounded-md px-1.5 text-xs text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground data-[active=true]:bg-foreground/[0.1] data-[active=true]:text-foreground data-[level=dispatcher]:font-semibold data-[level=dispatcher]:text-foreground"
        >
          {children}
          <span className="grid shrink-0 place-items-center">
            <HubStateIndicator kind={agentHubIndicatorKind(thread)} />
          </span>
          {/* Which agent it is, like the window header's avatar. */}
          {agent ? <AgentIcon agent={agent} size={12} /> : null}
          <span className="truncate">{title}</span>
        </button>
      </AgentHubThreadHoverCard>
      {actions.onJump ? (
        <button
          type="button"
          aria-label={translate(
            'agentHub.mirror.jumpHint',
            'Jump to this terminal in its workspace'
          )}
          title={translate('agentHub.mirror.jumpHint', 'Jump to this terminal in its workspace')}
          onClick={actions.onJump}
          className="grid size-5 shrink-0 place-items-center rounded-md text-muted-foreground/70 hover:bg-foreground/[0.07] hover:text-foreground"
        >
          <ArrowUpRight className="size-3" />
        </button>
      ) : null}
    </span>
  )
}

/**
 * The mirrored pane's place in its orchestration tree: the dispatchers above it (never the shown
 * pane itself), then the workers below as an indented tree. Picking any of them points this
 * window's active tab at that terminal.
 */
export function AgentHubMirrorFamilyTabs({
  family,
  activeKey,
  locationOf,
  actionsFor,
  onSelect
}: {
  family: AgentHubMirrorFamily
  activeKey: string
  locationOf: (thread: AgentPaneThread) => AgentHubLocation
  /** What a member's card (and its jump icon) offers, by where it is already shown. */
  actionsFor: (thread: AgentPaneThread) => AgentHubThreadCardActions
  onSelect: (thread: AgentPaneThread) => void
}): React.JSX.Element {
  const hasParentRow = family.ancestors.length > 0
  const renderNode = (node: AgentHubFamilyNode): React.JSX.Element => (
    <Fragment key={node.thread.paneKey}>
      {/* Indent is per level; the elbow reaches up to the row it hangs from. */}
      <div
        role="none"
        className="flex min-w-0 items-center px-2"
        style={{ paddingLeft: `${8 + node.depth * 14}px` }}
      >
        {hasParentRow || node.depth > 0 ? (
          <span
            aria-hidden
            className="-mt-3 mr-1 ml-1.5 h-4 w-2.5 shrink-0 self-start rounded-bl-sm border-b border-l border-muted-foreground/40"
          />
        ) : null}
        <FamilyButton
          thread={node.thread}
          level="worker"
          depth={node.depth}
          active={node.thread.paneKey === activeKey}
          location={locationOf(node.thread)}
          actions={actionsFor(node.thread)}
          onSelect={onSelect}
        />
      </div>
      {node.children.map(renderNode)}
    </Fragment>
  )
  return (
    <nav
      aria-label={translate('agentHub.mirror.family', 'Dispatcher and workers')}
      className="relative flex shrink-0 flex-col border-b border-border bg-popover/70 py-1"
    >
      {hasParentRow ? (
        <div className="flex min-w-0 items-center gap-1 px-2">
          {family.ancestors.map((thread, index) => (
            <Fragment key={thread.paneKey}>
              {index > 0 ? (
                <ChevronRight aria-hidden className="size-3 shrink-0 text-muted-foreground/60" />
              ) : null}
              <FamilyButton
                thread={thread}
                level="dispatcher"
                active={false}
                location={locationOf(thread)}
                actions={actionsFor(thread)}
                onSelect={onSelect}
              >
                {index === 0 ? (
                  <Workflow aria-hidden className="size-3 shrink-0 text-muted-foreground" />
                ) : null}
              </FamilyButton>
            </Fragment>
          ))}
        </div>
      ) : null}
      <div
        role="tree"
        aria-label={translate('agentHub.mirror.workers', 'Workers')}
        className="mt-0.5 flex max-h-40 min-w-0 flex-col gap-0.5 overflow-y-auto scrollbar-sleek"
      >
        {family.tree.map(renderNode)}
      </div>
    </nav>
  )
}
