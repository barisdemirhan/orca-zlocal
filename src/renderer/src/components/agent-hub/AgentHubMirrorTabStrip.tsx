import { useLayoutEffect, useRef } from 'react'
import { AudioLines, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import type { AgentHubLineage } from './agent-hub-lineage'
import type { AgentHubMirrorWindowState, AgentHubMirrorTab } from './agent-hub-mirror-membership'
import {
  activateAgentHubMirrorTab,
  closeAgentHubMirrorTab
} from './agent-hub-mirror-tab-operations'
import {
  requestAgentHubMirrorSelection,
  useAgentHubMirrorSelection
} from './agent-hub-mirror-selection'
import { useAgentHubDictationSession } from './agent-hub-dictation-origin'
import { agentHubMirrorDictationPane, mirrorOwnsDictation } from './agent-hub-mirror-mic-state'
import { agentHubIndicatorKind } from './agent-hub-lists'
import { agentHubTargetShowsThread } from './agent-hub-pane-target'
import { HubAvatar, HubStateIndicator } from './AgentHubAtoms'
import { useAgentHubTargetTitle } from './AgentHubMirrorTitle'
import { AgentHubMirrorAddButton } from './AgentHubMirrorAddButton'

export function agentHubMirrorPanelId(windowId: string): string {
  return `mirror-panel-${windowId}`
}
export function agentHubMirrorTabId(tabId: string): string {
  return `mirror-tab-${tabId}`
}

function MirrorTab({
  tab,
  active,
  thread,
  inputOwner,
  panelId,
  onSelect,
  onClose
}: {
  tab: AgentHubMirrorTab
  active: boolean
  thread: AgentPaneThread | null
  inputOwner: boolean
  panelId: string
  onSelect: (focusTerminal: boolean) => void
  onClose: () => void
}): React.JSX.Element {
  const title = useAgentHubTargetTitle(tab.target)
  const kind = thread ? agentHubIndicatorKind(thread) : 'idle'
  return (
    <div
      data-active={active}
      className="group/tab flex min-w-24 max-w-48 basis-40 items-center gap-1 rounded-t-md border border-transparent px-1 data-[active=true]:border-border data-[active=true]:bg-background"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            role="tab"
            id={agentHubMirrorTabId(tab.id)}
            aria-controls={panelId}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            data-agent-hub-tab-id={tab.id}
            data-kind={kind}
            onClick={() => onSelect(true)}
            className="flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 text-xs text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground aria-selected:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="shrink-0">
              <HubStateIndicator kind={kind} />
            </span>
            <HubAvatar agentType={tab.target.agentType} kind={thread ? kind : null} />
            <span className="truncate">{title}</span>
            {inputOwner ? (
              <AudioLines
                aria-label={translate('agentHub.mic.listeningTab', 'Dictation in this terminal')}
                className="size-3 shrink-0"
              />
            ) : null}
          </button>
        </TooltipTrigger>
        <TooltipContent>{title}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={translate('agentHub.mirror.returnTab', 'Return {{value0}} to workspace', {
              value0: title
            })}
            onClick={onClose}
          >
            <X />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {translate('agentHub.mirror.returnToWorkspace', 'Return to workspace')}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

export function AgentHubMirrorTabStrip({
  window,
  threads,
  lineage
}: {
  window: AgentHubMirrorWindowState
  threads: readonly AgentPaneThread[]
  lineage: AgentHubLineage
}): React.JSX.Element {
  const stripRef = useRef<HTMLDivElement>(null)
  const selection = useAgentHubMirrorSelection()
  const seen = useRef(0)
  const session = useAgentHubDictationSession()
  useLayoutEffect(() => {
    if (selection.seq === seen.current || selection.windowId !== window.id) {
      return
    }
    seen.current = selection.seq
    if (!selection.revealTab) {
      return
    }
    document
      .getElementById(agentHubMirrorTabId(selection.tabId))
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [selection, window.id])
  const select = (tabId: string, focusTerminal: boolean): void => {
    activateAgentHubMirrorTab(window.id, tabId, focusTerminal)
  }
  const close = (tab: AgentHubMirrorTab): void => {
    const hadFocus = stripRef.current?.contains(document.activeElement) === true
    closeAgentHubMirrorTab(window.id, tab.id)
    if (tab.id === window.activeTabId && hadFocus) {
      const index = window.tabs.indexOf(tab)
      const neighbour = window.tabs[index + 1] ?? window.tabs[index - 1]
      if (neighbour) {
        requestAgentHubMirrorSelection(window.id, neighbour.id, false)
        requestAnimationFrame(() =>
          document.getElementById(agentHubMirrorTabId(neighbour.id))?.focus({ preventScroll: true })
        )
      }
    }
  }
  return (
    <div
      className="flex shrink-0 items-center gap-1 border-b border-border bg-muted px-1 pt-1"
      data-agent-hub-tab-strip
    >
      <div
        ref={stripRef}
        role="tablist"
        aria-label={translate('agentHub.mirror.terminals', 'Mirror terminals')}
        className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto scrollbar-sleek"
        onKeyDown={(event) => {
          if (
            !(event.target instanceof HTMLElement) ||
            event.target.getAttribute('role') !== 'tab' ||
            event.nativeEvent.isComposing ||
            event.metaKey ||
            event.ctrlKey ||
            event.altKey
          ) {
            return
          }
          const focusedId = event.target.id
          const index = window.tabs.findIndex((tab) => agentHubMirrorTabId(tab.id) === focusedId)
          let next = index
          if (event.key === 'ArrowLeft') {
            next = (index + window.tabs.length - 1) % window.tabs.length
          } else if (event.key === 'ArrowRight') {
            next = (index + 1) % window.tabs.length
          } else if (event.key === 'Home') {
            next = 0
          } else if (event.key === 'End') {
            next = window.tabs.length - 1
          } else if (event.key === 'Enter') {
            event.preventDefault()
            requestAgentHubMirrorSelection(window.id, window.activeTabId)
            return
          } else {
            return
          }
          event.preventDefault()
          event.stopPropagation()
          const tab = window.tabs[next]
          if (tab) {
            select(tab.id, false)
            document.getElementById(agentHubMirrorTabId(tab.id))?.focus({ preventScroll: true })
          }
        }}
      >
        {window.tabs.map((tab) => (
          <MirrorTab
            key={tab.id}
            tab={tab}
            active={window.activeTabId === tab.id}
            panelId={agentHubMirrorPanelId(window.id)}
            thread={threads.find((thread) => agentHubTargetShowsThread(tab.target, thread)) ?? null}
            inputOwner={mirrorOwnsDictation(session, agentHubMirrorDictationPane(tab.target))}
            onSelect={(focusTerminal) => select(tab.id, focusTerminal)}
            onClose={() => close(tab)}
          />
        ))}
      </div>
      <AgentHubMirrorAddButton
        windowId={window.id}
        count={window.tabs.length}
        threads={threads}
        lineage={lineage}
      />
    </div>
  )
}
