import { Fragment, useLayoutEffect, useRef } from 'react'
import { ChevronRight, Workflow } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { activityThreadRowCopy } from '../activity/activity-thread-presentation'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import { HubStateIndicator } from './AgentHubAtoms'
import { agentHubIndicatorKind } from './agent-hub-lists'
import type { AgentHubMirrorFamily } from './agent-hub-mirror-family'

function FamilyButton({
  thread,
  level,
  active,
  childCount = 0,
  onSelect,
  buttonRef,
  children
}: {
  thread: AgentPaneThread
  level: 'dispatcher' | 'worker'
  active: boolean
  childCount?: number
  onSelect: (thread: AgentPaneThread) => void
  buttonRef?: React.Ref<HTMLButtonElement>
  children?: React.ReactNode
}): React.JSX.Element {
  const title = activityThreadRowCopy(thread).taskTitle
  return (
    <button
      ref={buttonRef}
      type="button"
      role={level === 'worker' ? 'tab' : undefined}
      aria-selected={level === 'worker' ? active : undefined}
      aria-current={level === 'dispatcher' && active ? 'page' : undefined}
      data-level={level}
      data-active={active}
      title={title}
      onClick={() => onSelect(thread)}
      className="flex h-6 max-w-[220px] shrink-0 items-center gap-1.5 rounded-md px-1.5 text-[11.5px] text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground data-[active=true]:bg-foreground/[0.1] data-[active=true]:text-foreground data-[level=dispatcher]:font-semibold data-[level=dispatcher]:text-foreground"
    >
      {children}
      <span data-family-dot className="grid shrink-0 place-items-center">
        <HubStateIndicator kind={agentHubIndicatorKind(thread)} />
      </span>
      <span className="truncate">{title}</span>
      {childCount > 0 ? (
        <span
          aria-label={translate('agentHub.mirror.workerCount', '{{value0}} workers', {
            value0: childCount
          })}
          className="flex shrink-0 items-center rounded-[4px] bg-foreground/[0.08] pl-1 font-mono text-[10px] tabular-nums"
        >
          {childCount}
          <ChevronRight aria-hidden className="size-3" />
        </span>
      ) : null}
    </button>
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
  onSelect
}: {
  family: AgentHubMirrorFamily
  activeKey: string
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
          className="-mt-1 mr-1 h-4 w-2.5 shrink-0 self-start rounded-bl-[5px] border-b border-l border-muted-foreground/40"
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
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    </nav>
  )
}
