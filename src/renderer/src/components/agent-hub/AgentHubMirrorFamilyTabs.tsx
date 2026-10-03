import { Fragment } from 'react'
import { ChevronRight, CornerDownRight, Workflow } from 'lucide-react'
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
  children
}: {
  thread: AgentPaneThread
  level: 'dispatcher' | 'worker'
  active: boolean
  childCount?: number
  onSelect: (thread: AgentPaneThread) => void
  children?: React.ReactNode
}): React.JSX.Element {
  const title = activityThreadRowCopy(thread).taskTitle
  return (
    <button
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
      <HubStateIndicator kind={agentHubIndicatorKind(thread)} />
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
 * The mirrored pane's place in its orchestration tree: the dispatchers above it as a path, then
 * the workers of the last one. Picking any of them shows that terminal in the same window; a
 * worker with workers of its own opens a level deeper, and the path leads back up.
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
  return (
    <nav
      aria-label={translate('agentHub.mirror.family', 'Dispatcher and workers')}
      className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-popover/70 px-2 py-1 scrollbar-sleek"
    >
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
          >
            {index === 0 ? (
              <Workflow aria-hidden className="size-3 shrink-0 text-muted-foreground" />
            ) : null}
          </FamilyButton>
        </Fragment>
      ))}
      {/* The workers sit in their own tray, so they read as children of the path's last agent. */}
      <div
        role="tablist"
        aria-label={translate('agentHub.mirror.workers', 'Workers')}
        className="ml-0.5 flex shrink-0 items-center gap-0.5 rounded-md bg-foreground/[0.04] p-0.5"
      >
        <CornerDownRight aria-hidden className="mx-1 size-3 shrink-0 text-muted-foreground/70" />
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
    </nav>
  )
}
