import { useLayoutEffect, useRef } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { AgentHubMirrorTab } from './AgentHubMirrorTab'
import { useAgentHubMirrorDrag } from './AgentHubMirrorTabDragLayer'
import { useMirrorTabStripScroll } from './use-mirror-tab-strip-scroll'
import { translate } from '@/i18n/i18n'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import type { AgentHubLineage } from './agent-hub-lineage'
import {
  shownAgentHubMirrorTarget,
  type AgentHubMirrorWindowState,
  type AgentHubMirrorTab as MirrorTabEntry
} from './agent-hub-mirror-membership'
import {
  activateAgentHubMirrorTab,
  closeAgentHubMirrorTab,
  returnAgentHubMirrorTabToWorkspace
} from './agent-hub-mirror-tab-operations'
import {
  requestAgentHubMirrorSelection,
  useAgentHubMirrorSelection
} from './agent-hub-mirror-selection'
import { useAgentHubDictationSession } from './agent-hub-dictation-origin'
import { agentHubMirrorDictationPane, mirrorOwnsDictation } from './agent-hub-mirror-mic-state'
import {
  agentHubTargetShowsThread,
  type AgentHubLocation,
  type AgentHubPaneTarget
} from './agent-hub-pane-target'
import { AgentHubMirrorAddButton } from './AgentHubMirrorAddButton'
import { agentHubMirrorFamily } from './agent-hub-mirror-family'
import { readAgentHubHiddenFamilyBars, toggleAgentHubFamilyBar } from './agent-hub-family-bar'
import { focusAgentHubFamilyTree } from './AgentHubMirrorFamilyTabs'

export function agentHubMirrorPanelId(windowId: string): string {
  return `mirror-panel-${windowId}`
}
export function agentHubMirrorTabId(tabId: string): string {
  return `mirror-tab-${tabId}`
}

export function AgentHubMirrorTabStrip({
  window,
  threads,
  lineage,
  locationOf,
  onReveal
}: {
  window: AgentHubMirrorWindowState
  threads: readonly AgentPaneThread[]
  lineage: AgentHubLineage
  locationOf: (target: AgentHubPaneTarget) => AgentHubLocation
  onReveal: (target: AgentHubPaneTarget, thread: AgentPaneThread | null) => void
}): React.JSX.Element {
  const stripRef = useRef<HTMLDivElement>(null)
  const drag = useAgentHubMirrorDrag()
  const droppable = useDroppable({ id: `mirror-strip:${window.id}`, disabled: !drag.enabled })
  const scroll = useMirrorTabStripScroll(stripRef, window.tabs.length)
  const append =
    drag.allowed &&
    drag.drop?.kind === 'strip' &&
    drag.drop.windowId === window.id &&
    drag.drop.entryId === null
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
  const familyRootOf = (tab: MirrorTabEntry): string | null => {
    const paneKey =
      tab.target.paneKey ??
      threads.find((thread) => agentHubTargetShowsThread(tab.target, thread))?.paneKey
    return (
      (paneKey ? agentHubMirrorFamily(paneKey, threads, lineage)?.path[0]?.paneKey : null) ?? null
    )
  }
  const select = (tabId: string, focusTerminal: boolean): void => {
    activateAgentHubMirrorTab(window.id, tabId, focusTerminal)
  }
  const close = (tab: MirrorTabEntry): void => {
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
      // Why the add button sits outside the tablist: it stays put while the tabs scroll.
      className="flex min-w-0 shrink items-center gap-1.5 self-stretch"
      data-agent-hub-tab-strip={window.id}
      ref={droppable.setNodeRef}
    >
      <div
        ref={stripRef}
        role="tablist"
        aria-label={translate('agentHub.mirror.terminals', 'Mirror terminals')}
        className="terminal-tab-strip relative flex min-w-0 flex-1 gap-0.5 overflow-x-auto"
        onPointerMove={scroll.onPointerMove}
        onPointerLeave={scroll.onPointerLeave}
        onScroll={scroll.onScroll}
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
          } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            // Down opens the workers bar and steps into it; Up folds it away again.
            const root = window.tabs[index] ? familyRootOf(window.tabs[index]) : null
            if (!root) {
              return
            }
            event.preventDefault()
            event.stopPropagation()
            const tabElement = event.target
            if (event.key === 'ArrowUp') {
              if (!readAgentHubHiddenFamilyBars().has(root)) {
                toggleAgentHubFamilyBar(root)
              }
              return
            }
            if (readAgentHubHiddenFamilyBars().has(root)) {
              toggleAgentHubFamilyBar(root)
              // Why a frame: the bar mounts on the next render.
              requestAnimationFrame(() => focusAgentHubFamilyTree(tabElement))
            } else {
              focusAgentHubFamilyTree(tabElement)
            }
            return
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
          <AgentHubMirrorTab
            key={tab.id}
            windowId={window.id}
            tab={tab}
            active={window.activeTabId === tab.id}
            panelId={agentHubMirrorPanelId(window.id)}
            thread={threads.find((thread) => agentHubTargetShowsThread(tab.target, thread)) ?? null}
            location={locationOf(tab.target)}
            familyRoot={familyRootOf(tab)}
            closable={window.tabs.length > 1}
            inputOwner={mirrorOwnsDictation(
              session,
              agentHubMirrorDictationPane(shownAgentHubMirrorTarget(tab))
            )}
            onSelect={(focusTerminal) => select(tab.id, focusTerminal)}
            onReveal={() => {
              if (!tab.isPinned) {
                returnAgentHubMirrorTabToWorkspace(window.id, tab.id)
              }
              onReveal(
                tab.target,
                threads.find((thread) => agentHubTargetShowsThread(tab.target, thread)) ?? null
              )
            }}
            onClose={() => close(tab)}
          />
        ))}
        <div
          data-append={append}
          className="min-w-4 flex-1 data-[append=true]:border-l-2 data-[append=true]:border-ring"
        />
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
