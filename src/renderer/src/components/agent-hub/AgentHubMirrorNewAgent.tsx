import { useId, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAgentDetectionTargetForWorktree } from '@/hooks/useAgentDetectionTarget'
import { useDetectedAgents } from '@/hooks/useDetectedAgents'
import { translate } from '@/i18n/i18n'
import { AgentIcon } from '@/lib/agent-catalog'
import { useAppStore } from '@/store'
import { DEFAULT_DISABLED_TUI_AGENTS } from '../../../../shared/tui-agent-selection'
import type { TuiAgent } from '../../../../shared/tui-agent'
import type { Worktree } from '../../../../shared/worktree/types'
import { getActivityThreadWorkspaceTitle } from '@/lib/activity-thread-display'
import {
  buildTabAgentLaunchOptions,
  orderTabLaunchAgents
} from '../tab-bar/tab-agent-launch-options'

export function AgentHubMirrorNewAgent({
  worktree,
  workspaceHeader = false,
  pending,
  onStart
}: {
  worktree: Worktree
  workspaceHeader?: boolean
  pending: boolean
  onStart: (worktree: Worktree, agent: TuiAgent) => void
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const choicesId = useId()
  const target = useAgentDetectionTargetForWorktree(worktree.id)
  const { detectedIds } = useDetectedAgents(target)
  const defaultAgent = useAppStore((state) => state.settings?.defaultTuiAgent)
  const disabled = useAppStore(
    (state) => state.settings?.disabledTuiAgents ?? DEFAULT_DISABLED_TUI_AGENTS
  )
  const options = buildTabAgentLaunchOptions(
    orderTabLaunchAgents(defaultAgent, detectedIds ?? [], disabled)
  )
  const workspace = getActivityThreadWorkspaceTitle(worktree)
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {workspaceHeader ? (
        <span
          className="opacity-0 group-hover/workspace:opacity-100 group-focus-within/workspace:opacity-100 data-[expanded=true]:opacity-100"
          data-expanded={expanded}
        >
          <Button
            variant="ghost"
            size="xs"
            aria-label={translate(
              'agentHub.mirror.addAgentInWorkspace',
              'Add agent in {{workspace}}',
              { workspace }
            )}
            aria-expanded={expanded}
            aria-controls={choicesId}
            onClick={() => setExpanded((value) => !value)}
          >
            <Plus />
            {translate('agentHub.mirror.agent', 'agent')}
          </Button>
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">
          {translate('agentHub.mirror.newAgent', 'New agent')}
        </span>
      )}
      {!workspaceHeader || expanded ? (
        <div
          id={choicesId}
          role="group"
          aria-label={translate(
            'agentHub.mirror.addAgentInWorkspace',
            'Add agent in {{workspace}}',
            { workspace }
          )}
          className="flex flex-wrap items-center gap-1"
          onKeyDown={(event) => {
            if (
              event.defaultPrevented ||
              event.nativeEvent.isComposing ||
              event.metaKey ||
              event.ctrlKey ||
              event.altKey ||
              !(event.target instanceof HTMLButtonElement)
            ) {
              return
            }
            const direction =
              event.key === 'ArrowRight' || event.key === 'ArrowDown'
                ? 1
                : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
                  ? -1
                  : 0
            if (!direction) {
              return
            }
            const buttons = Array.from(
              event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
            )
            const index = buttons.indexOf(event.target)
            if (index === -1) {
              return
            }
            event.preventDefault()
            event.stopPropagation()
            buttons[(index + direction + buttons.length) % buttons.length]?.focus()
          }}
        >
          {options.map(({ agent, label }) => {
            const name = translate(
              'agentHub.mirror.newAgentInWorkspace',
              'New {{agent}} agent in {{workspace}}',
              { agent: label, workspace }
            )
            return (
              <Tooltip key={agent}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={pending}
                    aria-label={name}
                    onClick={() => onStart(worktree, agent)}
                  >
                    <AgentIcon agent={agent} size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent respectReducedMotion>{name}</TooltipContent>
              </Tooltip>
            )
          })}
          {options.length === 0 ? (
            <span className="text-xs text-muted-foreground">
              {detectedIds && detectedIds.length > 0
                ? translate(
                    'auto.components.tab.bar.QuickLaunchButton.8dea9b5cdf',
                    'No enabled agents'
                  )
                : translate(
                    'auto.components.tab.bar.QuickLaunchButton.e518f544b1',
                    'No agents detected'
                  )}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
