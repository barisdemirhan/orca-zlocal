import { render } from '@testing-library/react'
import { vi } from 'vitest'
import { projectStructuredItemsToNativeChat } from '../../../../shared/agent-session/view/structured-agent-session-projection'
import type { AgentJournalStatusItem } from '../../../../shared/agent-session/journal/agent-session-journal-types'
import { TooltipProvider } from '@/components/ui/tooltip'
import { MessageRow } from './messages/rows/NativeChatMessageRow'
import { NativeChatPresentationContext } from './native-chat-presentation-context'
import {
  NativeChatOrcaStopContext,
  type NativeChatOrcaStopView
} from './messages/notices/native-chat-orca-stop-context'

type ContinueOffer = Pick<NativeChatOrcaStopView, 'offeredTurnItemId' | 'continueNow'> &
  Partial<Pick<NativeChatOrcaStopView, 'usageLimitTurnItemId' | 'continueUsageLimit'>>

function orcaStopView(
  hostLabel: string | null,
  continueAvailable: boolean,
  remoteHost: boolean,
  offer: ContinueOffer
): NativeChatOrcaStopView {
  return {
    hostLabel,
    remoteHost,
    continueAvailable,
    usageLimitTurnItemId: null,
    continueUsageLimit: () => {},
    ...offer
  }
}

export const NO_OFFER = { offeredTurnItemId: null, continueNow: () => {} }

export function renderStatus(
  body: AgentJournalStatusItem,
  hostLabel: string | null = null,
  continueAvailable = false,
  remoteHost = false,
  agentName?: string,
  offer: ContinueOffer = NO_OFFER,
  presentation: 'chat' | 'orb' = 'chat'
): ReturnType<typeof render> {
  const [message] = projectStructuredItemsToNativeChat([
    {
      itemId: 'notice',
      sequence: 1,
      revision: 1,
      observedAt: 1,
      body,
      turnScope: { kind: 'turn', turnItemId: 'cut-turn' }
    }
  ])
  const view = orcaStopView(hostLabel, continueAvailable, remoteHost, offer)
  return render(
    <TooltipProvider>
      <NativeChatPresentationContext value={presentation}>
        <NativeChatOrcaStopContext.Provider value={view}>
          <MessageRow
            message={message!}
            agentName={agentName}
            expandSignal={false}
            onScrollMessageToTop={vi.fn()}
          />
        </NativeChatOrcaStopContext.Provider>
      </NativeChatPresentationContext>
    </TooltipProvider>
  )
}
