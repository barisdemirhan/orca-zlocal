import { Fragment } from 'react'
import { ArrowUpRight, ChevronRight, CornerUpLeft, Workflow } from 'lucide-react'
import { AgentHubActionTooltip } from './AgentHubShortcut'
import { translate } from '@/i18n/i18n'
import { AgentIcon } from '@/components/agent/icons/AgentIcon'
import { agentTypeToIconAgent } from '../../../../shared/agent-status/presentation/agent-type-icon-agent'
import { activityThreadRowCopy } from '../activity/activity-thread-presentation'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import { HubChip } from './AgentHubInlineLabels'
import { HubStateIndicator } from './AgentHubStateMarks'
import { agentHubIndicatorKind } from './agent-hub-lists'
import { agentHubMirrorFamilyRows, type AgentHubMirrorFamily } from './agent-hub-mirror-family'
import type { AgentHubLocation } from './agent-hub-pane-target'
import { AgentHubThreadHoverCard, type AgentHubThreadCardActions } from './AgentHubThreadHoverCard'

function windowRootOf(from: Element): ParentNode {
  return from.closest('[data-agent-hub-mirror]') ?? document
}

/** Moves focus from a tab into the workers tree: the active row, else the first. */
export function focusAgentHubFamilyTree(from: Element): void {
  const rows = windowRootOf(from).querySelectorAll<HTMLElement>('[role="tree"] [role="treeitem"]')
  const target = Array.from(rows).find((row) => row.tabIndex === 0) ?? rows[0]
  target?.focus({ preventScroll: false })
}

function focusActiveTab(from: Element): void {
  windowRootOf(from)
    .querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
    ?.focus({ preventScroll: true })
}

function FamilyButton({
  thread,
  level,
  depth = 0,
  active,
  tabStop = false,
  location,
  actions,
  onSelect,
  returnTitle,
  childCount = 0,
  expanded,
  children
}: {
  thread: AgentPaneThread
  level: 'dispatcher' | 'worker'
  /** Nesting of a worker row, announced as its tree level. */
  depth?: number
  active: boolean
  /** The tree's one Tab stop; the other rows are reached with the arrow keys. */
  tabStop?: boolean
  location: AgentHubLocation
  actions: AgentHubThreadCardActions
  onSelect: (thread: AgentPaneThread) => void
  returnTitle?: string
  childCount?: number
  expanded?: boolean
  children?: React.ReactNode
}): React.JSX.Element {
  const title = activityThreadRowCopy(thread).taskTitle
  const agent = agentTypeToIconAgent(thread.agentType)
  const returnHint = returnTitle
    ? translate('agentHub.mirror.returnAgain', 'Click again to return to {{value0}}', {
        value0: returnTitle
      })
    : undefined
  return (
    <span className="flex shrink-0 items-center">
      <AgentHubThreadHoverCard
        thread={thread}
        location={location}
        actions={actions}
        hint={returnHint}
      >
        <button
          type="button"
          aria-description={returnHint}
          role={level === 'worker' ? 'treeitem' : undefined}
          aria-level={level === 'worker' ? depth + 1 : undefined}
          aria-selected={level === 'worker' ? active : undefined}
          aria-expanded={childCount ? expanded : undefined}
          aria-current={level === 'dispatcher' && active ? 'page' : undefined}
          tabIndex={level === 'worker' && !tabStop ? -1 : undefined}
          data-pane-key={thread.paneKey}
          data-level={level}
          data-active={active}
          data-current={active || undefined}
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
          {childCount ? <HubChip>{childCount}</HubChip> : null}
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
 * pane itself), then the workers below as an indented tree. Navigation keeps the tab's home.
 */
export function AgentHubMirrorFamilyTabs({
  family,
  activeKey,
  home,
  locationOf,
  actionsFor,
  onSelect
}: {
  family: AgentHubMirrorFamily
  activeKey: string
  home?: { title: string; onSelect: () => void }
  locationOf: (thread: AgentPaneThread) => AgentHubLocation
  /** What a member's card (and its jump icon) offers, by where it is already shown. */
  actionsFor: (thread: AgentPaneThread) => AgentHubThreadCardActions
  onSelect: (thread: AgentPaneThread) => void
}): React.JSX.Element {
  const hasParentRow = family.ancestors.length > 0
  const rows = agentHubMirrorFamilyRows(family, activeKey)
  const shownNodes = rows.flatMap((row) => row.nodes)
  const stopKey = shownNodes.some((node) => node.thread.paneKey === activeKey)
    ? activeKey
    : rows[0]?.nodes[0]?.thread.paneKey
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
                active={thread.paneKey === activeKey}
                location={locationOf(thread)}
                actions={actionsFor(thread)}
                onSelect={onSelect}
                returnTitle={thread.paneKey === activeKey ? home?.title : undefined}
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
        onKeyDown={(event) => {
          const row = event.target
          if (
            !(row instanceof HTMLElement) ||
            row.getAttribute('role') !== 'treeitem' ||
            event.nativeEvent.isComposing ||
            event.metaKey ||
            event.ctrlKey ||
            event.altKey
          ) {
            return
          }
          const currentRow = row.closest('[data-family-row]')
          const siblings = Array.from(
            currentRow?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? []
          )
          const index = siblings.indexOf(row)
          const parentKey =
            currentRow instanceof HTMLElement ? currentRow.dataset.familyParent : null
          const parent = parentKey
            ? Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-pane-key]')).find(
                (chip) => chip.dataset.paneKey === parentKey
              )
            : null
          const childRow = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>('[data-family-row]')
          ).find(
            (entry) =>
              Boolean(row.dataset.paneKey) && entry.dataset.familyParent === row.dataset.paneKey
          )
          if (event.key === 'Escape' || (event.key === 'ArrowUp' && !parent)) {
            // Esc belongs to tree navigation before it reaches the window close handler.
            event.preventDefault()
            event.stopPropagation()
            focusActiveTab(row)
          } else if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
            event.preventDefault()
            event.stopPropagation()
            const destination =
              event.key === 'ArrowDown'
                ? childRow?.querySelector<HTMLElement>('[role="treeitem"]')
                : event.key === 'ArrowUp'
                  ? parent
                  : siblings[index + (event.key === 'ArrowRight' ? 1 : -1)]
            destination?.focus()
          }
        }}
        className="mt-0.5 flex max-h-40 min-w-0 flex-col gap-0.5 overflow-y-auto scrollbar-sleek"
      >
        {rows.map((row, index) => (
          <div key={row.parentKey ?? 'home'} role="none" className="flex min-w-0 items-center px-2">
            {index > 0 ? (
              <span
                aria-hidden
                className="-mt-3 mr-1 ml-1.5 h-4 w-2.5 shrink-0 self-start rounded-bl-sm border-b border-l border-muted-foreground/40"
              />
            ) : null}
            <div
              role="group"
              data-family-row
              data-family-parent={row.parentKey ?? undefined}
              className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto scrollbar-sleek"
            >
              {index === 0 && home ? (
                <AgentHubActionTooltip
                  label={translate('agentHub.mirror.backHome', 'Back to {{value0}}', {
                    value0: home.title
                  })}
                >
                  <button
                    type="button"
                    role="treeitem"
                    aria-level={1}
                    aria-selected={false}
                    tabIndex={stopKey ? -1 : 0}
                    onClick={home.onSelect}
                    className="flex h-6 max-w-55 shrink-0 items-center gap-1.5 rounded-md px-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    <CornerUpLeft aria-hidden className="size-3" />
                    <span className="truncate">{home.title}</span>
                  </button>
                </AgentHubActionTooltip>
              ) : null}
              {row.nodes.map((node) => (
                <FamilyButton
                  key={node.thread.paneKey}
                  thread={node.thread}
                  level="worker"
                  depth={node.depth}
                  active={node.thread.paneKey === activeKey}
                  tabStop={node.thread.paneKey === stopKey}
                  childCount={node.children.length}
                  expanded={rows.some((entry) => entry.parentKey === node.thread.paneKey)}
                  location={locationOf(node.thread)}
                  actions={actionsFor(node.thread)}
                  onSelect={onSelect}
                  returnTitle={node.thread.paneKey === activeKey ? home?.title : undefined}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </nav>
  )
}
