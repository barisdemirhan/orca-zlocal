import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store'
import { useNow } from '@/lib/window-activity/use-now'
import { cn } from '@/lib/class-names'
import { translate } from '@/i18n/i18n'
import { agentHubSurfaceSetting } from '../../../../shared/agent-hub-surface-settings'
import { nativeChatCompletedTaskCount } from '../../../../shared/native-chat/input/task-lists/native-chat-task-list'
import { isMacPlatform } from '@/components/native-chat/pane/routing/native-chat-shortcut'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import { isAgentHubChatTab } from './agent-hub-chat-tabs'
import { agentHubIndicatorKind } from './agent-hub-lists'
import type { AgentHubLineage } from './agent-hub-lineage'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import { agentHubMirrorSourceKey } from './agent-hub-mirror-membership'
import { useAgentHubPaneSleep } from './agent-hub-pane-sleep'
import {
  mirrorWork,
  useAgentHubMirrorChanges,
  useAgentHubMirrorReview
} from './agent-hub-mirror-card-facts'
import {
  closeAgentHubMirrorDrawer,
  openAgentHubMirrorDrawer,
  useAgentHubMirrorDrawer,
  useAgentHubMirrorStripShown,
  type AgentHubMirrorDrawer
} from './agent-hub-mirror-drawer-store'
import {
  useAgentHubMirrorChatPlan,
  useAgentHubMirrorChatSettings,
  useAgentHubMirrorQueue
} from './agent-hub-mirror-chat-feed'
import {
  useNoteAgentHubMirrorTurns,
  useOpenAgentHubMirrorOnFailedCheck,
  useRecordAgentHubMirrorEvents
} from './use-agent-hub-mirror-card-effects'
import { AgentHubMirrorWorkStrip } from './AgentHubMirrorWorkStrip'
import { AgentHubMirrorWorkDrawer } from './AgentHubMirrorWorkDrawer'
import { AgentHubMirrorChangesDrawer } from './AgentHubMirrorChangesDrawer'
import { AgentHubMirrorReviewDrawer } from './AgentHubMirrorReviewDrawer'
import { AgentHubMirrorInboundDrawer } from './AgentHubMirrorInboundDrawer'
import { AgentHubMirrorSettingsDrawer } from './AgentHubMirrorSettingsDrawer'

// Below this the drawer goes under the terminal instead of beside it.
const SIDE_DRAWER_MIN_WIDTH = 640

function useMirrorCardWide(ref: React.RefObject<HTMLDivElement | null>): boolean {
  const [wide, setWide] = useState(false)
  useEffect(() => {
    const element = ref.current
    if (!element) {
      return undefined
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setWide(entry.contentRect.width >= SIDE_DRAWER_MIN_WIDTH)
      }
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return wide
}

/**
 * The strip of chips and the drawer around a mirror's terminal or chat. Its children keep one
 * place in the tree whether the strip or a drawer is shown, so the pane never remounts.
 */
export function AgentHubMirrorCardBody({
  windowId,
  target,
  thread,
  lineage,
  active,
  children
}: {
  windowId: string
  target: AgentHubPaneTarget
  thread: AgentPaneThread | null
  lineage: AgentHubLineage
  /** False while the pane is shown in the workspace instead, when there is nothing to attach to. */
  active: boolean
  children: React.ReactNode
}): React.JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null)
  const sourceKey = agentHubMirrorSourceKey(target)
  const isChat = useAppStore((s) => isAgentHubChatTab(s, target.tab.id))
  const isAgent = thread !== null || target.agentType !== null
  const now = useNow(5_000)
  const work = mirrorWork(thread, lineage, now)
  const changes = useAgentHubMirrorChanges(target)
  const review = useAgentHubMirrorReview(target)
  const queue = useAgentHubMirrorQueue(target.tab.id)
  const plan = useAgentHubMirrorChatPlan(target.tab.id)
  const planProgress = plan ? `${nativeChatCompletedTaskCount(plan)}/${plan.tasks.length}` : null
  const contextPercent =
    useAgentHubMirrorChatSettings(target.tab.id)?.contextUsage?.percentage ?? null
  const shown = useAgentHubMirrorDrawer(sourceKey)
  const stripShown = useAgentHubMirrorStripShown(sourceKey)
  const position = useAppStore((s) =>
    agentHubSurfaceSetting(s.settings, 'agentHubMirrorDrawerPosition')
  )
  const openOnFailed = useAppStore((s) =>
    agentHubSurfaceSetting(s.settings, 'agentHubMirrorOpenOnFailedCheck')
  )
  const phase = useAgentHubPaneSleep(target).phase
  const asleep = phase === 'sleeping'
  const offline = phase === 'unverifiable'
  const wide = useMirrorCardWide(rootRef)
  const side = position === 'side' || (position === 'auto' && wide)

  useRecordAgentHubMirrorEvents(sourceKey)
  useNoteAgentHubMirrorTurns(sourceKey, thread ? agentHubIndicatorKind(thread) : 'idle')
  useOpenAgentHubMirrorOnFailedCheck(
    sourceKey,
    openOnFailed && active,
    review?.failedChecks.map((check) => check.name) ?? [],
    shown
  )

  const toggle = (drawer: AgentHubMirrorDrawer): void => {
    if (shown === drawer) {
      closeAgentHubMirrorDrawer(sourceKey, 'user')
    } else {
      openAgentHubMirrorDrawer(sourceKey, drawer, 'user')
    }
  }
  const drawerOff = asleep || offline
  const drawerBody =
    shown === null ? null : shown === 'work' ? (
      <AgentHubMirrorWorkDrawer
        work={work}
        tabId={target.tab.id}
        windowId={windowId}
        now={now}
        disabled={drawerOff}
      />
    ) : shown === 'inbound' ? (
      <AgentHubMirrorInboundDrawer tabId={target.tab.id} isChat={isChat} disabled={drawerOff} />
    ) : shown === 'changes' ? (
      changes ? (
        <AgentHubMirrorChangesDrawer worktree={target.worktree} changes={changes} />
      ) : null
    ) : shown === 'pr' ? (
      review ? (
        <AgentHubMirrorReviewDrawer
          card={{
            worktreeId: target.worktree.id,
            worktreePath: target.worktree.path,
            tabId: target.tab.id,
            repo: target.repo
          }}
          review={review}
        />
      ) : null
    ) : (
      <AgentHubMirrorSettingsDrawer tabId={target.tab.id} isChat={isChat} disabled={drawerOff} />
    )
  const drawer =
    active && drawerBody ? (
      <div
        role="region"
        aria-label={translate('agentHub.mirror.drawer.label', 'Drawer')}
        className={cn(
          'scrollbar-sleek min-w-0 shrink-0 overflow-y-auto bg-popover px-1.5 pb-2',
          side ? 'w-74 border-l border-border' : 'h-56 border-t border-border'
        )}
      >
        {drawerBody}
      </div>
    ) : null

  return (
    <div
      ref={rootRef}
      className="relative flex min-h-0 flex-1"
      onKeyDownCapture={(event) => {
        const mod = isMacPlatform() ? event.metaKey : event.ctrlKey
        // Ctrl+I is Tab in a terminal and a text field's own key off macOS.
        const inTypingTarget =
          !isMacPlatform() &&
          event.target instanceof HTMLElement &&
          event.target.closest(
            '.xterm, input, textarea, select, [contenteditable="true"], [contenteditable=""]'
          ) !== null
        if (
          active &&
          !inTypingTarget &&
          mod &&
          !event.shiftKey &&
          !event.altKey &&
          event.key.toLowerCase() === 'i' &&
          !event.nativeEvent.isComposing
        ) {
          event.preventDefault()
          event.stopPropagation()
          if (shown) {
            closeAgentHubMirrorDrawer(sourceKey, 'user')
          } else {
            openAgentHubMirrorDrawer(sourceKey, isAgent ? 'work' : 'changes', 'user')
          }
        }
      }}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        {children}
        {active && stripShown ? (
          <AgentHubMirrorWorkStrip
            work={work}
            queued={queue ? queue.cards.length : null}
            changes={changes}
            review={review}
            contextPercent={contextPercent}
            planProgress={planProgress}
            isAgent={isAgent}
            shown={shown}
            asleep={asleep}
            offline={offline}
            onToggle={toggle}
          />
        ) : null}
        {side ? null : drawer}
      </div>
      {side ? drawer : null}
    </div>
  )
}
