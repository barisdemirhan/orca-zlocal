import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bot } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { useShortcutLabel } from '@/hooks/useShortcutLabel'
import { AgentQuestionIcon } from '@/components/AgentQuestionIcon'
import { AgentStateDot } from '@/components/AgentStateDot'
import { AgentWorkingSpinner } from '@/components/AgentWorkingSpinner'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS } from '../status-bar/status-bar-context-menu-policy'
import { useAgentPaneThreads } from '../activity/use-agent-pane-threads'
import { activateWorkspacePaneTarget } from '../activity/activity-thread-actions'
import { activityThreadRowCopy } from '../activity/activity-thread-presentation'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import { AgentHubMirrorWindow } from './AgentHubMirrorWindow'
import { AgentHubPanel, type AgentHubOpenRequest } from './AgentHubPanel'
import { registerAgentHubCommands } from './agent-hub-commands'
import { agentHubCounts, buildAgentHubLists, type AgentHubLists } from './agent-hub-lists'
import {
  agentHubLocationLabel,
  agentHubPaneTargetKey,
  paneTargetFromThread,
  type AgentHubPaneTarget
} from './agent-hub-pane-target'
import { useAgentHubTerminalTree } from './use-agent-hub-terminal-tree'

function useGroupNameById(): ReadonlyMap<string, string> {
  const projectGroups = useAppStore((s) => s.projectGroups)
  return useMemo(
    () => new Map(projectGroups.map((group) => [group.id, group.name])),
    [projectGroups]
  )
}

/** Mounted only while the popover is open: the tree subscribes to every tab write. */
function AgentHubPopoverBody({
  lists,
  threads,
  rootRef,
  onJump,
  onPopout
}: {
  lists: AgentHubLists
  threads: readonly AgentPaneThread[]
  rootRef: React.RefObject<HTMLDivElement | null>
  onJump: (request: AgentHubOpenRequest) => void
  onPopout: (request: AgentHubOpenRequest) => void
}): React.JSX.Element {
  const tree = useAgentHubTerminalTree(threads)
  const groupNameById = useGroupNameById()
  const acknowledgeAgents = useAppStore((s) => s.acknowledgeAgents)
  const terminalCount = tree.reduce((total, group) => total + group.rowCount, 0)
  return (
    <AgentHubPanel
      lists={lists}
      tree={tree}
      terminalCount={terminalCount}
      locationOf={(target) => agentHubLocationLabel(target, groupNameById)}
      rootRef={rootRef}
      onJump={onJump}
      onPopout={onPopout}
      onMarkRead={acknowledgeAgents}
    />
  )
}

/** Status-bar entry for the Agent Hub: live counts, the popover, and the mirror window. */
export function AgentHubStatusSegment({ iconOnly }: { iconOnly: boolean }): React.JSX.Element {
  const { markAllReadThreads: threads } = useAgentPaneThreads({
    query: '',
    readFilter: 'all',
    groupBy: 'none',
    selectedPaneKey: null
  })
  const lists = useMemo(() => buildAgentHubLists(threads), [threads])
  const counts = agentHubCounts(lists)
  const acknowledgeAgents = useAppStore((s) => s.acknowledgeAgents)
  const groupNameById = useGroupNameById()
  const shortcut = useShortcutLabel('agentHub.toggle')
  const [open, setOpen] = useState(false)
  const [mirror, setMirror] = useState<AgentHubPaneTarget | null>(null)
  const panelRootRef = useRef<HTMLDivElement>(null)
  // Why: Radix hands focus back to the trigger on close; a terminal user expects their pane back.
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const openRef = useRef(open)
  useEffect(() => {
    openRef.current = open
  }, [open])
  const setPopoverOpen = useCallback((next: boolean) => {
    if (next) {
      restoreFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
    }
    setOpen(next)
  }, [])
  // A jump or pop-out focuses its own target, so nothing is restored.
  const closeForNavigation = useCallback(() => {
    restoreFocusRef.current = null
    setOpen(false)
  }, [])

  const jump = useCallback(
    ({ target, thread }: AgentHubOpenRequest) => {
      closeForNavigation()
      activateWorkspacePaneTarget(
        {
          worktree: target.worktree,
          repo: target.repo,
          tabId: target.tab.id,
          paneKey: target.paneKey
        },
        { revealInSidebar: true }
      )
      if (thread) {
        acknowledgeAgents([thread.paneKey])
      }
    },
    [acknowledgeAgents, closeForNavigation]
  )
  const popout = useCallback(
    ({ target, thread }: AgentHubOpenRequest) => {
      closeForNavigation()
      setMirror(target)
      if (thread) {
        acknowledgeAgents([thread.paneKey])
      }
    },
    [acknowledgeAgents, closeForNavigation]
  )

  // Why a ref: the chord handlers are registered once but must see the newest queue.
  const needsYouRef = useRef(lists.needsYou)
  useEffect(() => {
    needsYouRef.current = lists.needsYou
  }, [lists.needsYou])
  useEffect(
    () =>
      registerAgentHubCommands({
        toggle: () => setPopoverOpen(!openRef.current),
        jumpToNextWaiting: () => {
          const next = needsYouRef.current[0]
          if (!next) {
            toast(translate('agentHub.toast.nobodyWaiting', 'Nobody is waiting on you'))
            return
          }
          jump({
            target: paneTargetFromThread(next, activityThreadRowCopy(next).taskTitle),
            thread: next
          })
        }
      }),
    [jump, setPopoverOpen]
  )

  const mirrorThread = mirror?.paneKey
    ? (threads.find((thread) => thread.paneKey === mirror.paneKey) ?? null)
    : null
  const label =
    counts.needsYou === 1
      ? translate('agentHub.trigger.needsYouOne', '1 needs you')
      : counts.needsYou > 1
        ? translate('agentHub.trigger.needsYouOther', '{{value0}} need you', {
            value0: counts.needsYou
          })
        : translate('agentHub.title', 'Agents')

  return (
    <>
      <Popover open={open} onOpenChange={setPopoverOpen}>
        <Tooltip delayDuration={150}>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                {...STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS}
                data-attention={counts.needsYou > 0}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-[11px] text-muted-foreground tabular-nums hover:bg-accent/70 data-[attention=true]:text-foreground"
                aria-label={label}
              >
                <Bot className="size-3.5" />
                {counts.working > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <AgentWorkingSpinner className="size-1.5" />
                    {counts.working}
                  </span>
                ) : null}
                {counts.needsYou > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <AgentQuestionIcon className="size-2.5" />
                    {counts.needsYou}
                  </span>
                ) : null}
                {counts.finished > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <AgentStateDot state="done" title={null} />
                    {counts.finished}
                  </span>
                ) : null}
                {iconOnly ? null : <span className="font-medium">{label}</span>}
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6}>
            {translate('agentHub.title', 'Agents')} ({shortcut})
          </TooltipContent>
        </Tooltip>
        <PopoverContent
          side="top"
          align="end"
          sideOffset={8}
          {...STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS}
          collisionPadding={{ top: 8, bottom: 32, left: 8, right: 8 }}
          className="w-[440px] max-w-[calc(100vw-2rem)]"
          data-agent-hub-panel
          onOpenAutoFocus={(event) => {
            // Why: the panel root owns the arrow/number keys, so it takes focus, not the first button.
            event.preventDefault()
            panelRootRef.current?.focus()
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            const previous = restoreFocusRef.current
            restoreFocusRef.current = null
            if (previous?.isConnected) {
              previous.focus()
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
          <AgentHubPopoverBody
            lists={lists}
            threads={threads}
            rootRef={panelRootRef}
            onJump={jump}
            onPopout={popout}
          />
        </PopoverContent>
      </Popover>
      {mirror ? (
        <AgentHubMirrorWindow
          key={agentHubPaneTargetKey(mirror)}
          target={mirror}
          thread={mirrorThread}
          subtitle={agentHubLocationLabel(mirror, groupNameById)}
          onClose={() => setMirror(null)}
          onReveal={() => {
            setMirror(null)
            jump({ target: mirror, thread: mirrorThread })
          }}
        />
      ) : null}
    </>
  )
}
