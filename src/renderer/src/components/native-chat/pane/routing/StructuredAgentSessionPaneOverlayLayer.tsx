import { memo, useCallback, useMemo } from 'react'
import { AgentHubOrbSessionOperationGuard } from '../../../agent-hub/AgentHubOrbOperationOverlay'
import { useShallow } from 'zustand/react/shallow'
import type { Tab, TabGroup } from '../../../../../../shared/tab-types'
import { useAppStore } from '@/store'
import { useThemeBackgroundStore } from '@/store/appearance/theme-background'
import {
  structuredAgentSessionOwnerForTab,
  structuredAgentSessionTargetForHost
} from '@/runtime/native-chat/session-ownership/structured-agent-session-owner'
import { RetainedPaneHost } from '../../../tab-group/RetainedPaneHost'
import NativeChatView from '../../NativeChatView'
import { isStructuredTab } from '../../../../../../shared/agent-session/view/structured-agent-session-tab'
import { useAgentHubChatDestination } from '../../../agent-hub/agent-hub-chat-destinations'
import { useAgentHubOrbPanel } from '../../../agent-hub/agent-hub-orb-panel-store'
import { AgentHubOrbComposerContext } from '../../../agent-hub/agent-hub-orb-composer'
import { NativeChatPresentationContext } from '../../native-chat-presentation-context'
import {
  AgentHubOrbVoiceContext,
  useRegisteredAgentHubOrbVoice
} from '../../../agent-hub/agent-hub-orb-voice-context'
import { structuredAgentSessionHostKey } from '@/runtime/native-chat/host-capabilities/structured-agent-session-host-capability'

type StructuredAgentSessionTab = Tab & {
  contentType: 'agent-session'
  agentSessionAgent: NonNullable<Tab['agentSessionAgent']>
}

const EMPTY_UNIFIED_TABS: readonly Tab[] = []
const EMPTY_GROUPS: readonly TabGroup[] = []

const StructuredAgentSessionOverlaySlot = memo(function StructuredAgentSessionOverlaySlot({
  tab,
  groupId,
  isActive,
  isFocusedGroup,
  hasSplitGroups,
  onFocusOwningGroup
}: {
  tab: StructuredAgentSessionTab
  groupId: string | undefined
  isActive: boolean
  isFocusedGroup: boolean
  hasSplitGroups: boolean
  onFocusOwningGroup: ((groupId: string) => void) | undefined
}): React.JSX.Element | null {
  // Resolve from the tab’s recorded host because workspace ids can collide across hosts.
  const owner = useAppStore((state) => structuredAgentSessionOwnerForTab(state, tab))
  const target = useMemo(() => structuredAgentSessionTargetForHost(owner), [owner])
  const voice = useRegisteredAgentHubOrbVoice(
    tab.id,
    tab.entityId,
    target ? structuredAgentSessionHostKey(target) : ''
  )
  const orbDestination = useAgentHubOrbPanel((s) =>
    s.session?.tabId === tab.id ? s.destination : null
  )
  const chatVisible = useAgentHubOrbPanel((s) => s.chatVisible)
  const mirror = useAgentHubChatDestination(tab.id)
  const destination = orbDestination ?? mirror?.element ?? null
  const visible = orbDestination ? chatVisible : mirror ? mirror.visible : isActive
  const focused = orbDestination ? chatVisible : mirror ? mirror.focused : isFocusedGroup
  const themeBackgroundActive = useThemeBackgroundStore((state) => state.active)
  if (!target) {
    return null
  }
  return (
    <RetainedPaneHost
      groupId={groupId}
      isVisible={isActive}
      // Why not over a theme image: the chat is translucent there, so a dim would bleed the image in.
      dimmed={hasSplitGroups && !isFocusedGroup && !themeBackgroundActive}
      data-structured-agent-session-overlay-tab-id={tab.id}
      onFocusOwningGroup={onFocusOwningGroup}
      retainContent
      destination={destination}
    >
      <AgentHubOrbComposerContext value={orbDestination ? tab.id : null}>
        <NativeChatPresentationContext value={orbDestination ? 'orb' : 'chat'}>
          <AgentHubOrbVoiceContext value={voice}>
            <AgentHubOrbSessionOperationGuard
              host={target.kind === 'environment' ? target.environmentId : 'local'}
              sessionId={tab.entityId}
            >
              <NativeChatView
                mode="structured"
                tabId={tab.id}
                groupId={destination ? undefined : groupId}
                sessionId={tab.entityId}
                agent={tab.agentSessionAgent}
                isVisible={visible}
                isFocusedGroup={focused}
                target={target}
              />
            </AgentHubOrbSessionOperationGuard>
          </AgentHubOrbVoiceContext>
        </NativeChatPresentationContext>
      </AgentHubOrbComposerContext>
    </RetainedPaneHost>
  )
})

const StructuredAgentSessionPaneOverlayLayer = memo(
  function StructuredAgentSessionPaneOverlayLayer({
    worktreeId,
    isWorktreeActive
  }: {
    worktreeId: string
    isWorktreeActive: boolean
  }): React.JSX.Element {
    const { unifiedTabs, groups, activeGroupId } = useAppStore(
      useShallow((state) => ({
        unifiedTabs: state.unifiedTabsByWorktree[worktreeId] ?? EMPTY_UNIFIED_TABS,
        groups: state.groupsByWorktree[worktreeId] ?? EMPTY_GROUPS,
        activeGroupId: state.activeGroupIdByWorktree[worktreeId]
      }))
    )
    const focusGroup = useAppStore((state) => state.focusGroup)
    const focusOwningGroup = useCallback(
      (groupId: string) => focusGroup(worktreeId, groupId),
      [focusGroup, worktreeId]
    )
    const groupActiveTabById = useMemo(
      () => new Map(groups.map((group) => [group.id, group.activeTabId] as const)),
      [groups]
    )
    const structuredTabs = useMemo(
      () => unifiedTabs.filter((tab): tab is StructuredAgentSessionTab => isStructuredTab(tab)),
      [unifiedTabs]
    )

    return (
      <>
        {structuredTabs.map((tab) => (
          <StructuredAgentSessionOverlaySlot
            key={tab.id}
            tab={tab}
            groupId={tab.groupId}
            isActive={Boolean(isWorktreeActive && groupActiveTabById.get(tab.groupId) === tab.id)}
            isFocusedGroup={Boolean(
              isWorktreeActive &&
              groupActiveTabById.get(tab.groupId) === tab.id &&
              tab.groupId === activeGroupId
            )}
            hasSplitGroups={groups.length > 1}
            onFocusOwningGroup={focusOwningGroup}
          />
        ))}
      </>
    )
  }
)

export default StructuredAgentSessionPaneOverlayLayer
