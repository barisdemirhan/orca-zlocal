import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { launchAgentInNewTabWithOutcome } from '@/lib/agent-session/launch/new-tab/launch-agent-in-new-tab'
import { activateAndRevealWorktree } from '@/lib/workspace/activation/worktree-activation'
import { createNonSecureContextUuid } from '../../../../shared/identifiers/non-secure-context-uuid'
import { sleepAgentHubPane } from './agent-hub-pane-sleep-operations'
import { paneTargetFromTerminalRow, type AgentHubPaneTarget } from './agent-hub-pane-target'
import type { AgentHubGroupNode, AgentHubTerminalRow } from './agent-hub-terminal-tree'
import { agentHubRowIsIdleAgent } from './agent-hub-tree-bot-groups'

/** The idle agents of a group, including those the idle fold hides; working and asking ones never. */
export function agentHubIdleRowsOf(group: AgentHubGroupNode): AgentHubTerminalRow[] {
  return group.workspaces.flatMap((workspace) =>
    workspace.idleFold
      ? workspace.idleFold.rows
      : workspace.rows.filter((row) => row.children.length === 0 && agentHubRowIsIdleAgent(row))
  )
}

async function sleepIdleAgents(
  rows: readonly AgentHubTerminalRow[],
  isSleeping: (target: AgentHubPaneTarget) => boolean
): Promise<void> {
  const targets = rows
    .filter((row) => row.thread !== null || row.idleAgent !== null)
    .map(paneTargetFromTerminalRow)
    .filter((target) => !isSleeping(target))
  const results = await Promise.allSettled(targets.map((target) => sleepAgentHubPane(target)))
  const failed = results.filter((result) => result.status === 'rejected').length
  if (failed > 0) {
    toast.message(
      translate('agentHub.groupMenu.sleepSkipped', '{{count}} agents could not sleep', {
        count: failed,
        defaultValue_one: '{{count}} agent could not sleep'
      })
    )
  }
}

/** The right-click menu of a project heading. */
export function AgentHubGroupContextMenu({
  group,
  isSleeping,
  onCollapseOthers,
  enabled,
  children
}: {
  group: AgentHubGroupNode
  isSleeping: (target: AgentHubPaneTarget) => boolean
  onCollapseOthers: () => void
  /** The sleeping and bots groups are not projects, so they have no project menu. */
  enabled: boolean
  children: React.ReactNode
}): React.JSX.Element {
  const first = group.workspaces[0]?.worktree
  const defaultAgent = useAppStore((s) => s.settings?.defaultTuiAgent)
  const idleRows = agentHubIdleRowsOf(group)
  if (!enabled) {
    return <>{children}</>
  }
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          disabled={!first}
          onSelect={() => first && activateAndRevealWorktree(first.id)}
        >
          {translate('agentHub.groupMenu.open', 'Open project')}
        </ContextMenuItem>
        <ContextMenuItem onSelect={onCollapseOthers}>
          {translate('agentHub.groupMenu.collapseOthers', 'Collapse others')}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          disabled={!first}
          onSelect={() => {
            if (first) {
              launchAgentInNewTabWithOutcome({
                requestId: createNonSecureContextUuid(),
                agent: defaultAgent && defaultAgent !== 'blank' ? defaultAgent : 'claude',
                worktreeId: first.id,
                launchSource: 'tab_bar_quick_launch',
                activate: true
              })
            }
          }}
        >
          {translate('agentHub.groupMenu.newAgent', 'New agent here')}
        </ContextMenuItem>
        <ContextMenuItem
          disabled={idleRows.length === 0}
          onSelect={() => void sleepIdleAgents(idleRows, isSleeping)}
        >
          {translate('agentHub.groupMenu.sleepIdle', 'Sleep idle agents')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
