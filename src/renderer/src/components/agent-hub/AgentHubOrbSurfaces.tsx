import { useCallback, useMemo, useRef } from 'react'
import { useAppStore } from '@/store'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import { AgentHubOrbButton } from './AgentHubOrbButton'
import { AgentHubOrbPill } from './AgentHubOrbPill'
import { translate } from '@/i18n/i18n'
import type { AgentHubPreferences } from './use-agent-hub-settings'
import { agentHubDockPopoverSide } from './agent-hub-dock-geometry'
import { agentHubCounts } from './agent-hub-lists'
import { agentHubOrbRequest, agentHubOrbThread } from './agent-hub-orb-state'
import {
  agentHubInboxRequests,
  agentHubAwayAnswerCount,
  useAgentHubRequests
} from './agent-hub-requests-store'
import type { AgentHubLists } from './agent-hub-lists'
import { useAgentHubOrb } from './agent-hub-orb-session'

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
  const preferredPlacement = useAppStore((s) => s.settings?.agentHubOrbPlacement ?? 'dock')
  const placement =
    preferredPlacement === 'dock' && preferences.placement === 'status-bar'
      ? 'statusBar'
      : preferredPlacement
  const statusRef = useRef<HTMLSpanElement>(null)
  const pillVisible = orb.state.kind !== 'off' && orb.state.kind !== 'idle'
  const { openOrb } = orb
  const open = useCallback(() => {
    void openOrb()
  }, [openOrb])
  const hubLists = useMemo(
    () => ({
      ...lists,
      needsYou: lists.needsYou.filter((thread) => !agentHubOrbThread(thread, orb.session?.tabId)),
      finished: lists.finished.filter((thread) => !agentHubOrbThread(thread, orb.session?.tabId))
    }),
    [lists, orb.session?.tabId]
  )
  const requests = useAgentHubRequests()
  const counts = agentHubCounts(
    { ...lists, needsYou: hubLists.needsYou },
    agentHubInboxRequests(requests).filter((item) => !agentHubOrbRequest(item)).length,
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
    placement === 'dock' ? { state: orb.state, disabled: !agentControl, onOpen: open } : null
  const statusButton =
    placement === 'statusBar' ? (
      <span ref={statusRef} className="flex items-center">
        <AgentHubOrbButton state={orb.state} disabled={!agentControl} side="top" onOpen={open} />
      </span>
    ) : null
  const pill =
    pillVisible && !hidden ? (
      <AgentHubOrbPill
        state={orb.state}
        sessionId={orb.session?.sessionId ?? ''}
        readState={orb.readState}
        anchorRef={placement === 'statusBar' ? statusRef : anchorRef}
        side={placement === 'statusBar' ? 'top' : side}
        onOpen={open}
      />
    ) : null
  return { counts, label, hubLists, dockButton, statusButton, pill, pillVisible, open }
}
