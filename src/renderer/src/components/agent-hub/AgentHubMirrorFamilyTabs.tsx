import { Fragment, useLayoutEffect, useRef } from 'react'
import { ArrowUpRight, ChevronRight, Workflow } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { AgentIcon } from '@/lib/agent-catalog'
import { agentTypeToIconAgent } from '@/lib/agent-status'
import { activityThreadRowCopy } from '../activity/activity-thread-presentation'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import { HubStateIndicator } from './AgentHubStateMarks'
import { agentHubIndicatorKind } from './agent-hub-lists'
import type { AgentHubMirrorFamily } from './agent-hub-mirror-family'
import type { AgentHubLocation } from './agent-hub-pane-target'
import { AgentHubThreadHoverCard, type AgentHubThreadCardActions } from './AgentHubThreadHoverCard'

function FamilyButton({
  thread,
  level,
  active,
  childCount = 0,
  location,
  actions,
  onSelect,
  buttonRef,
  children
}: {
  thread: AgentPaneThread
  level: 'dispatcher' | 'worker'
  active: boolean
  childCount?: number
  location: AgentHubLocation
  actions: AgentHubThreadCardActions
  onSelect: (thread: AgentPaneThread) => void
  buttonRef?: React.Ref<HTMLButtonElement>
  children?: React.ReactNode
}): React.JSX.Element {
  const title = activityThreadRowCopy(thread).taskTitle
  const agent = agentTypeToIconAgent(thread.agentType)
  return (
    <span className="flex shrink-0 items-center">
      <AgentHubThreadHoverCard thread={thread} location={location} actions={actions}>
        <button
          ref={buttonRef}
          type="button"
          role={level === 'worker' ? 'tab' : undefined}
          aria-selected={level === 'worker' ? active : undefined}
          aria-current={level === 'dispatcher' && active ? 'page' : undefined}
          data-level={level}
          data-active={active}
          onClick={() => onSelect(thread)}
          className="flex h-6 max-w-55 shrink-0 items-center gap-1.5 rounded-md px-1.5 text-xs text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground data-[active=true]:bg-foreground/[0.1] data-[active=true]:text-foreground data-[level=dispatcher]:font-semibold data-[level=dispatcher]:text-foreground"
        >
          {children}
          <span data-family-dot className="grid shrink-0 place-items-center">
            <HubStateIndicator kind={agentHubIndicatorKind(thread)} />
          </span>
          {/* Which agent it is, like the window header's avatar. */}
          {agent ? <AgentIcon agent={agent} size={12} /> : null}
          <span className="truncate">{title}</span>
          {childCount > 0 ? (
            <span
              aria-label={translate('agentHub.mirror.workerCount', '{{value0}} workers', {
                value0: childCount
              })}
              className="flex shrink-0 items-center rounded-sm bg-foreground/[0.08] pl-1 font-mono text-[11px] tabular-nums"
            >
              {childCount}
              <ChevronRight aria-hidden className="size-3" />
            </span>
          ) : null}
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
 * The mirrored pane's place in its orchestration tree, as two rows: the dispatchers above it,
 * then the workers of the last one on a branch drawn from under it. Picking any of them shows
 * that terminal in the same window; a worker with workers of its own opens a level deeper.
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
  const parentRef = useRef<HTMLButtonElement>(null)
  const branchRef = useRef<HTMLDivElement>(null)
  const pathKey = family.path.map((thread) => thread.paneKey).join('/')
  // Why measured: the workers' row hangs from the state dot of whichever parent the path ends on.
  useLayoutEffect(() => {
    const dot = parentRef.current?.querySelector<HTMLElement>('[data-family-dot]')
    const branch = branchRef.current
    if (dot && branch) {
      branch.style.paddingLeft = `${Math.round(dot.offsetLeft + dot.offsetWidth / 2)}px`
    }
  }, [pathKey])
  const lastIndex = family.path.length - 1
  return (
    <nav
      aria-label={translate('agentHub.mirror.family', 'Dispatcher and workers')}
      className="relative flex shrink-0 flex-col border-b border-border bg-popover/70 py-1"
    >
      <div className="flex min-w-0 items-center gap-1 px-2">
        {family.path.map((thread, index) => (
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
              buttonRef={index === lastIndex ? parentRef : undefined}
            >
              {index === 0 ? (
                <Workflow aria-hidden className="size-3 shrink-0 text-muted-foreground" />
              ) : null}
            </FamilyButton>
          </Fragment>
        ))}
      </div>
      <div ref={branchRef} className="mt-0.5 flex min-w-0 items-center">
        {/* The elbow reaches up to the parent above, so the row reads as its children. */}
        <span
          aria-hidden
          className="-mt-1 mr-1 h-4 w-2.5 shrink-0 self-start rounded-bl-sm border-b border-l border-muted-foreground/40"
        />
        <div
          role="tablist"
          aria-label={translate('agentHub.mirror.workers', 'Workers')}
          className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto pr-2 scrollbar-sleek"
        >
          {family.members.map((member) => (
            <FamilyButton
              key={member.thread.paneKey}
              thread={member.thread}
              level="worker"
              active={member.thread.paneKey === activeKey}
              childCount={member.childCount}
              location={locationOf(member.thread)}
              actions={actionsFor(member.thread)}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    </nav>
  )
}
