import { Circle, CircleCheck, CircleDot, Loader2 } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { activityThreadRowCopy } from '../activity/threads/activity-thread-presentation'
import type { AgentChildRowModel } from '../../../../shared/agent-status/presentation/agent-child-row-model'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import { backgroundTaskRowStopId } from '../../../../shared/agent-status/presentation/background-tasks/background-task-roster'
import {
  canStopOrchestrationWorker,
  stopOrchestrationWorker
} from '@/lib/stop-orchestration-worker'
import {
  nativeChatCompletedTaskCount,
  nativeChatTaskLabel
} from '../../../../shared/native-chat/input/task-lists/native-chat-task-list'
import { useAgentHubMirrorChatPlan, useAgentHubMirrorChatWork } from './agent-hub-mirror-chat-feed'
import { agentHubIndicatorKind } from './agent-hub-lists'
import { paneTargetFromThread } from './agent-hub-pane-target'
import { addAgentHubMirrorTab } from './agent-hub-mirror-tab-operations'
import type { MirrorWork } from './agent-hub-mirror-card-facts'
import {
  DrawerLink,
  DrawerNote,
  DrawerRow,
  DrawerSection,
  formatDrawerElapsed
} from './AgentHubMirrorDrawerParts'

function childLabel(row: AgentChildRowModel): string {
  return row.name || row.agentType || row.kind
}

function workerStateLabel(kind: ReturnType<typeof agentHubIndicatorKind>): string {
  switch (kind) {
    case 'ask':
      return translate('agentHub.mirror.drawer.workerAsking', 'asking')
    case 'work':
      return translate('agentHub.mirror.drawer.workerWorking', 'working')
    case 'done':
    case 'read':
      return translate('agentHub.mirror.drawer.workerDone', 'done')
    case 'idle':
      return translate('agentHub.mirror.drawer.workerIdle', 'idle')
  }
}

/** The dispatch to stop: only a worker still working on this computer's own runtime. */
function workerStopId(worker: AgentPaneThread): string | null {
  const dispatchId =
    worker.paneEntry?.orchestration?.dispatchId ??
    worker.currentAgentEntry?.orchestration?.dispatchId
  const here = !worker.worktree.runtimeOwnerEnvironmentId && !worker.repo?.connectionId
  return dispatchId &&
    here &&
    canStopOrchestrationWorker({ kind: 'local' }) &&
    agentHubIndicatorKind(worker) === 'work'
    ? dispatchId
    : null
}

/** What the agent has running: its subagents, commands and dispatched workers. */
export function AgentHubMirrorWorkDrawer({
  work,
  tabId,
  windowId,
  now,
  disabled
}: {
  work: MirrorWork
  tabId: string
  windowId: string
  now: number
  disabled: boolean
}): React.JSX.Element {
  const plan = useAgentHubMirrorChatPlan(tabId)
  const chatWork = useAgentHubMirrorChatWork(tabId)
  const stopFor = (row: AgentChildRowModel): React.ReactNode => {
    const taskId = chatWork ? backgroundTaskRowStopId(row, chatWork.supportsStop) : null
    if (!chatWork || taskId === null) {
      return null
    }
    const stopping = chatWork.stop.stoppingTaskIds.has(taskId) || chatWork.stop.stoppingAll
    return (
      <DrawerLink disabled={disabled || stopping} onClick={() => chatWork.stop.onStop(taskId)}>
        {stopping
          ? translate('agentHub.mirror.drawer.stopping', 'Stopping…')
          : translate('agentHub.mirror.drawer.stop', 'Stop')}
      </DrawerLink>
    )
  }
  const empty =
    work.subagents.length === 0 && work.commands.length === 0 && work.workers.length === 0 && !plan
  if (empty) {
    return (
      <DrawerNote>
        {translate('agentHub.mirror.drawer.workEmpty', 'Nothing is running.')}
      </DrawerNote>
    )
  }
  const openWorker = (worker: AgentPaneThread): void => {
    addAgentHubMirrorTab(
      windowId,
      paneTargetFromThread(worker, activityThreadRowCopy(worker).taskTitle)
    )
  }
  return (
    <>
      {plan ? (
        <>
          <DrawerSection
            label={translate('agentHub.mirror.drawer.plan', 'Plan')}
            count={plan.tasks.length}
            action={
              <span className="font-mono text-[11px] text-muted-foreground">
                {nativeChatCompletedTaskCount(plan)}/{plan.tasks.length}
              </span>
            }
          />
          {plan.tasks.map((task, index) => (
            <DrawerRow
              key={`${index}:${task.content}`}
              lead={
                task.status === 'completed' ? (
                  <CircleCheck className="size-3.5 text-status-success" />
                ) : task.status === 'in_progress' ? (
                  <CircleDot className="size-3.5 text-foreground" />
                ) : (
                  <Circle className="size-3.5 text-muted-foreground" />
                )
              }
              title={task.content}
            >
              {nativeChatTaskLabel(task)}
            </DrawerRow>
          ))}
        </>
      ) : null}
      {work.subagents.length > 0 ? (
        <>
          <DrawerSection
            label={translate('agentHub.mirror.drawer.subagents', 'Subagents')}
            count={work.subagents.length}
          />
          {work.subagents.map((row) => (
            <DrawerRow
              key={row.id}
              lead={<Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
              trail={stopFor(row)}
              title={childLabel(row)}
            >
              {childLabel(row)}
            </DrawerRow>
          ))}
        </>
      ) : null}
      {work.commands.length > 0 ? (
        <>
          <DrawerSection
            label={translate('agentHub.mirror.drawer.commands', 'Commands')}
            count={work.commands.length}
          />
          {work.commands.map((row) => (
            <DrawerRow
              key={row.id}
              lead={<Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
              trail={
                <>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {formatDrawerElapsed(now - row.firstObservedAt)}
                  </span>
                  {stopFor(row)}
                </>
              }
              title={childLabel(row)}
            >
              <code className="font-mono text-xs">{childLabel(row)}</code>
            </DrawerRow>
          ))}
        </>
      ) : null}
      {work.workers.length > 0 ? (
        <>
          <DrawerSection
            label={translate('agentHub.mirror.drawer.workers', 'Workers')}
            count={work.workers.length}
          />
          {work.workers.map((worker) => (
            <DrawerRow
              key={worker.paneKey}
              trail={
                <>
                  <span className="text-[11px] text-muted-foreground">
                    {workerStateLabel(agentHubIndicatorKind(worker))}
                  </span>
                  {workerStopId(worker) ? (
                    <DrawerLink
                      disabled={disabled}
                      onClick={() => void stopOrchestrationWorker(workerStopId(worker) ?? '')}
                    >
                      {translate('agentHub.mirror.drawer.stop', 'Stop')}
                    </DrawerLink>
                  ) : null}
                  <DrawerLink disabled={disabled} onClick={() => openWorker(worker)}>
                    {translate('agentHub.mirror.drawer.openAsTab', 'Open as tab')}
                  </DrawerLink>
                </>
              }
            >
              {activityThreadRowCopy(worker).taskTitle}
            </DrawerRow>
          ))}
        </>
      ) : null}
    </>
  )
}
