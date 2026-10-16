import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { AgentJournalRenderItem } from '../../../../shared/agent-session-journal-types'
import { useAgentHubOrbPanel } from '../agent-hub/agent-hub-orb-panel-store'
import { registerRetainedPaneDestination } from '../tab-group/retained-pane-destinations'
import { structuredQuestionTranscript } from '../../../../shared/structured-agent-question-projection'
import { NativeChatResolutionReceipt } from './NativeChatResolutionReceipt'
import type { NativeChatResolvedPrompt } from './native-chat-resolution-receipt'
import { useAgentHubRequests, agentHubInboxRequests } from '../agent-hub/agent-hub-requests-store'
import { agentHubCurrentOrbRequest } from '../agent-hub/agent-hub-orb-request-owner'

const EMPTY_JOURNAL_ITEMS: readonly AgentJournalRenderItem[] = []

export function NativeChatOrbPromptSlot({
  tabId,
  sessionId,
  pending,
  children,
  host = 'local',
  journalItems = EMPTY_JOURNAL_ITEMS
}: {
  tabId: string
  sessionId: string
  pending: boolean
  children: ReactNode
  host?: string
  journalItems?: readonly AgentJournalRenderItem[]
}): React.JSX.Element {
  const destination = useAgentHubOrbPanel((state) =>
    state.session?.tabId === tabId && state.session.sessionId === sessionId
      ? state.requestDestination
      : null
  )
  const orbOnly = useAgentHubOrbPanel((state) => state.presentation === 'orb' || state.compact)
  const [dismissedReceipt, setDismissedReceipt] = useState<string | null>(null)
  const hubPending = agentHubInboxRequests(useAgentHubRequests()).some((item) =>
    agentHubCurrentOrbRequest(item, { host, sessionId })
  )
  const receipt = useMemo(() => {
    if (!destination || pending || !orbOnly || hubPending) {
      return null
    }
    const receipts = structuredQuestionTranscript(journalItems).receipts
    let latest: { itemId: string; body: NativeChatResolvedPrompt } | null = null
    for (const [itemId, body] of receipts) {
      if (body.resolution.state !== 'pending') {
        latest = { itemId, body }
      }
    }
    return latest?.itemId !== dismissedReceipt ? latest : null
  }, [destination, dismissedReceipt, hubPending, journalItems, orbOnly, pending])
  const requestVisible = pending || receipt !== null
  const homeRef = useRef<HTMLDivElement>(null)
  const [container] = useState(() => {
    const element = document.createElement('div')
    element.className = 'min-w-0 shrink-0'
    return element
  })
  useLayoutEffect(() => {
    const state = useAgentHubOrbPanel.getState()
    if (state.session?.tabId === tabId && state.session.sessionId === sessionId) {
      useAgentHubOrbPanel.setState({
        nativeRequestPending: pending,
        nativeRequestVisible: requestVisible
      })
    }
  }, [pending, requestVisible, sessionId, tabId, destination])
  useLayoutEffect(
    () => () => {
      const state = useAgentHubOrbPanel.getState()
      if (state.session?.tabId === tabId && state.session.sessionId === sessionId) {
        useAgentHubOrbPanel.setState({ nativeRequestPending: false, nativeRequestVisible: false })
      }
    },
    [sessionId, tabId]
  )
  useLayoutEffect(() => {
    const home = homeRef.current
    if (!home) {
      return undefined
    }
    const target = destination ?? home
    if (container.parentElement !== target) {
      target.appendChild(container)
    }
    if (destination) {
      return registerRetainedPaneDestination(destination, () => home.appendChild(container))
    }
    return undefined
  }, [container, destination])
  useLayoutEffect(() => {
    const home = homeRef.current
    return () => {
      home?.appendChild(container)
    }
  }, [container])
  return (
    <div ref={homeRef} className="contents">
      {createPortal(
        <>
          {children}
          {receipt?.body ? (
            <div className="space-y-2 p-3">
              <NativeChatResolutionReceipt body={receipt.body} disclosureId={receipt.itemId} />
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setDismissedReceipt(receipt.itemId)}
              >
                {translate('auto.agentHub.orb.dismissReceipt', 'Dismiss')}
              </Button>
            </div>
          ) : null}
        </>,
        container
      )}
    </div>
  )
}
