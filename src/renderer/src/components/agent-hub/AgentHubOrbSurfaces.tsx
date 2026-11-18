import { useCallback, useMemo, useRef } from 'react'
import { agentHubOrbPillShown } from './agent-hub-orb-sphere-action'
import { useAppStore } from '@/store'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import { AgentHubOrbButton } from './AgentHubOrbButton'
import { AgentHubFloatingOrb } from './AgentHubFloatingOrb'
import { AgentHubOrbPill } from './AgentHubOrbPill'
import { translate } from '@/i18n/i18n'
import type { AgentHubPreferences } from './use-agent-hub-settings'
import { agentHubDockPopoverSide } from './agent-hub-dock-geometry'
import { agentHubCounts } from './agent-hub-lists'
import { agentHubOrbThread } from './agent-hub-orb-state'
import { agentHubCurrentOrbRequest } from './agent-hub-orb-request-owner'
import {
  agentHubInboxRequests,
  agentHubAwayAnswerCount,
  useAgentHubRequests
} from './agent-hub-requests-store'
import type { AgentHubLists } from './agent-hub-lists'
import { useAgentHubOrb } from './agent-hub-orb-session'
import { closeAgentHubOrbPanel, useAgentHubOrbPanel } from './agent-hub-orb-panel-store'
import { AgentHubOrbPanel } from './AgentHubOrbPanel'
import { activateAgentHubOrb } from './agent-hub-orb-composer'

export function useAgentHubOrbSurfaces(
  threads: readonly AgentPaneThread[],
  lists: AgentHubLists,
  anchorRef: React.RefObject<HTMLElement | null>,
  preferences: AgentHubPreferences,
  hidden: boolean
) {
  const agentControl = preferences.agentControl
  const side =
    preferences.placement === 'dock'
      ? agentHubDockPopoverSide(preferences.dockPosition.edge)
      : 'top'
  const orb = useAgentHubOrb(threads)
  const panelSession = useAgentHubOrbPanel((s) => s.session)
  const panelOpen = panelSession !== null
  const chatVisible = useAgentHubOrbPanel((s) => s.chatVisible)
  const configuredPlacement = useAppStore((s) => s.settings?.agentHubOrbPlacement)
  const preferredPlacement =
    configuredPlacement === 'dock' ||
    configuredPlacement === 'statusBar' ||
    configuredPlacement === 'hidden'
      ? configuredPlacement
      : 'floating'
  const placement =
    preferredPlacement === 'dock' && preferences.placement === 'status-bar'
      ? 'statusBar'
      : preferredPlacement
  const statusRef = useRef<HTMLSpanElement>(null)
  const floatingRef = useRef<HTMLDivElement>(null)
  const orbAnchorRef =
    placement === 'floating' ? floatingRef : placement === 'statusBar' ? statusRef : anchorRef
  const orbSide = placement === 'floating' || placement === 'statusBar' ? 'top' : side
  const { openOrb } = orb
  const open = useCallback(() => {
    void openOrb(false, false)
  }, [openOrb])
  const togglePanel = useCallback(
    (alternate = false) => {
      if (useAgentHubOrbPanel.getState().session && !alternate) {
        closeAgentHubOrbPanel()
      } else if (alternate) {
        void openOrb(true)
      } else {
        // A plain click wakes the Orb straight into writing; the configured action stays on the shortcut.
        useAgentHubOrbPanel.setState({ quickInputOpen: true })
        void openOrb(false, false)
      }
    },
    [openOrb]
  )
  const hubLists = useMemo(
    () => ({
      ...lists,
      needsYou: lists.needsYou.filter((thread) => !agentHubOrbThread(thread, orb.session?.tabId)),
      finished: lists.finished.filter((thread) => !agentHubOrbThread(thread, orb.session?.tabId))
    }),
    [lists, orb.session?.tabId]
  )
  const requests = useAgentHubRequests()
  const requestSession = panelSession ?? orb.session
  const belongsToCurrentOrb = useCallback(
    (item: Parameters<typeof agentHubCurrentOrbRequest>[0]) =>
      agentHubCurrentOrbRequest(
        item,
        requestSession ? { host: 'local', sessionId: requestSession.sessionId } : null
      ),
    [requestSession]
  )
  const ownsRequest = useCallback(
    (item: Parameters<typeof agentHubCurrentOrbRequest>[0]) =>
      panelOpen && chatVisible && !hidden && belongsToCurrentOrb(item),
    [panelOpen, chatVisible, hidden, belongsToCurrentOrb]
  )
  const inbox = agentHubInboxRequests(requests)
  const pillVisible = agentHubOrbPillShown(orb.state.kind) && !inbox.some(belongsToCurrentOrb)
  const counts = agentHubCounts(
    { ...lists, needsYou: hubLists.needsYou },
    inbox.filter((item) => !ownsRequest(item)).length,
    agentHubAwayAnswerCount(requests)
  )
  const label =
    counts.needsYou === 1
      ? translate('agentHub.trigger.needsYouOne', '1 needs you')
      : counts.needsYou > 1
        ? translate('agentHub.trigger.needsYouOther', '{{value0}} need you', {
            value0: counts.needsYou
          })
        : translate('agentHub.title', 'Agents')
  const dockButton =
    placement === 'dock'
      ? { state: orb.state, disabled: !agentControl, onOpen: togglePanel, recall: panelOpen }
      : null
  const statusButton =
    placement === 'statusBar' ? (
      <span ref={statusRef} className="flex items-center">
        <AgentHubOrbButton
          state={orb.state}
          disabled={!agentControl}
          side="top"
          onOpen={togglePanel}
          recall={panelOpen}
        />
      </span>
    ) : null
  const floatingButton =
    placement === 'floating' && !hidden ? (
      <AgentHubFloatingOrb
        anchorRef={floatingRef}
        state={orb.state}
        disabled={!agentControl}
        onOpen={togglePanel}
      />
    ) : null
  const pill =
    pillVisible && !panelOpen && !hidden ? (
      <AgentHubOrbPill
        state={orb.state}
        sessionId={orb.session?.sessionId ?? ''}
        readState={orb.readState}
        anchorRef={orbAnchorRef}
        side={orbSide}
        onOpen={open}
      />
    ) : null
  const panel = (
    requestPresentationOf: Parameters<typeof AgentHubOrbPanel>[0]['requestPresentationOf']
  ) => (
    <AgentHubOrbPanel
      anchorRef={orbAnchorRef}
      side={orbSide}
      docked={placement === 'dock' && preferences.placement === 'dock'}
      floating={placement === 'floating'}
      hidden={hidden}
      state={orb.state}
      requestPresentationOf={requestPresentationOf}
    />
  )
  return {
    counts,
    label,
    hubLists,
    ownsRequest,
    dockButton,
    statusButton,
    floatingButton,
    pill,
    pillVisible,
    panelOpen,
    open,
    panel,
    toggle: activateAgentHubOrb
  }
}
