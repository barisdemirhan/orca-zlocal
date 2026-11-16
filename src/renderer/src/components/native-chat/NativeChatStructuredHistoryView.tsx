import { NativeChatUsageLimitActionsProvider } from '@/components/native-chat/usage/NativeChatUsageLimitActions'
import type { useNativeChatInterruptedContinuation } from '@/components/native-chat/usage/NativeChatInterruptedContinue'
import type { useNativeChatStructuredPaneNotices } from '@/components/native-chat/messages/notices/use-native-chat-structured-pane-notices'
import type { useStructuredChatLiveSession } from '@/components/native-chat/session/structured/use-structured-chat-live-session'
import type { useStructuredAgentSession } from '@/components/native-chat/session/structured/use-structured-agent-session'
import type { useStructuredAgentSessionDeliveryNotices } from '@/components/native-chat/session/structured/delivery/use-structured-agent-session-delivery-notices'
import { NativeChatEmptyState } from '@/components/native-chat/host-access/NativeChatEmptyState'
import { NativeChatEmptyPane } from '@/components/native-chat/host-access/NativeChatEmptyPane'
import { NativeChatLoadingCue } from '@/components/native-chat/host-access/NativeChatLoadingCue'
import { NativeChatHostSetupContext } from '@/components/native-chat/host-access/native-chat-host-setup'
import type { useNativeChatInstallSlot } from '@/components/native-chat/host-access/NativeChatInstallSlot'
import { NativeChatSubagentTranscripts } from '@/components/native-chat/subagents/NativeChatSubagentTranscripts'
import { NativeChatContextClearFade } from '@/components/native-chat/conversation/projection/NativeChatContextClearFade'
import type { useStructuredNativeChatSubmitReveal } from '@/components/native-chat/pane/actions/use-structured-native-chat-submit-reveal'
import type {
  selectNativeChatViewState,
  structuredChatHistoryPhase
} from '@/components/native-chat/session/status/native-chat-view-state'
import type { useNativeChatFind } from '@/components/native-chat/viewport/find/use-native-chat-find'
import { NativeChatFindBar } from '@/components/native-chat/viewport/find/NativeChatFindBar'
import type { useNativeChatFileLinkContext } from '@/components/native-chat/links/actions/use-native-chat-file-link-context'
import type { useNativeChatImageRuntimeContext } from '@/components/native-chat/media/images/native-chat-image-runtime-context'
import type { NativeChatStructuredViewProps } from '@/components/native-chat/native-chat-view-types'
import type { structuredAgentSessionReadFailureNotice } from '@/components/native-chat/messages/notices/structured-agent-session-read-failure-notice'
import { NativeChatRowActionsProvider } from '@/components/native-chat/messages/actions/NativeChatRowActionsProvider'
import type { useNativeChatPaneFork } from '@/components/native-chat/messages/actions/use-native-chat-fork'
import type { nativeChatWorkerApprovalParty } from '@/components/native-chat/worker-approvals/NativeChatWorkerApprovals'
import { NativeChatWorkerApprovalTimeline } from '@/components/native-chat/worker-approvals/NativeChatWorkerApprovals'

export function NativeChatStructuredHistoryView({
  pane,
  paneKey,
  viewState,
  readFailure,
  historyPhase,
  install,
  controller,
  forks,
  fileLinkContext,
  continuationView,
  setup,
  workerApprovalParty,
  find,
  submits,
  session,
  awaitingInput,
  stopping,
  deliveryNotices,
  runtimeContext
}: {
  pane: Omit<NativeChatStructuredViewProps, 'mode'>
  paneKey: string
  viewState: ReturnType<typeof selectNativeChatViewState>
  readFailure: ReturnType<typeof structuredAgentSessionReadFailureNotice> | null
  historyPhase: ReturnType<typeof structuredChatHistoryPhase>
  install: ReturnType<typeof useNativeChatInstallSlot>
  controller: ReturnType<typeof useStructuredAgentSession>
  forks: ReturnType<typeof useNativeChatPaneFork>
  fileLinkContext: ReturnType<typeof useNativeChatFileLinkContext>
  continuationView: ReturnType<typeof useNativeChatInterruptedContinuation>['view']
  setup: ReturnType<typeof useNativeChatStructuredPaneNotices>['setup']
  workerApprovalParty: ReturnType<typeof nativeChatWorkerApprovalParty>
  find: ReturnType<typeof useNativeChatFind>
  submits: ReturnType<typeof useStructuredNativeChatSubmitReveal>
  session: ReturnType<typeof useStructuredChatLiveSession>
  awaitingInput: boolean
  stopping: boolean
  deliveryNotices: ReturnType<typeof useStructuredAgentSessionDeliveryNotices>
  runtimeContext: ReturnType<typeof useNativeChatImageRuntimeContext>
}): React.JSX.Element {
  return (
    <NativeChatContextClearFade
      // A read failure stays in view: no divider may come to end the fade.
      clearing={controller.contextClear.clearing && viewState.kind !== 'error'}
      overlay={find.isOpen ? <NativeChatFindBar find={find} isVisible={pane.isVisible} /> : null}
    >
      {viewState.kind === 'loading' || (viewState.kind === 'error' && !readFailure) ? (
        historyPhase !== 'unread' && <NativeChatLoadingCue />
      ) : viewState.kind === 'error' ? (
        <NativeChatEmptyState
          kind="error"
          retrying={!readFailure?.final}
          {...(readFailure?.named ? { headline: readFailure.text } : {})}
        />
      ) : viewState.kind === 'empty' ? (
        <NativeChatEmptyPane slot={install.slot} agent={pane.agent} />
      ) : (
        <NativeChatRowActionsProvider pane={pane} chat={controller} forks={forks}>
          <NativeChatUsageLimitActionsProvider
            recovery={controller}
            pane={pane}
            directory={fileLinkContext}
            messages={controller.messages}
            view={continuationView}
          >
            <NativeChatHostSetupContext.Provider value={setup}>
              <NativeChatWorkerApprovalTimeline party={workerApprovalParty}>
                {(timedRows) => (
                  <NativeChatSubagentTranscripts
                    find={find}
                    // A rewind or a /clear replaces the conversation; nothing the old one held carries over.
                    key={`${controller.epoch}:${controller.contextClear.clears}`}
                    paneKey={paneKey}
                    ref={submits.messageListRef}
                    session={session}
                    journalItems={controller.journalItems}
                    journalSubmissions={controller.submissions}
                    journalLatestTurn={controller.latestTurn}
                    journalHostWork={controller.hostWork}
                    subagentRoster={controller.subagentRoster}
                    railOutline={controller.railOutline}
                    isVisible={pane.isVisible}
                    isWorking={controller.isWorking}
                    expandSignal={false}
                    workingStartedAt={controller.workingStartedAt}
                    settledTurns={controller.settledTurns}
                    awaitingInput={awaitingInput ? 'shown' : null}
                    turnActivity={controller.turnActivity}
                    stopping={stopping}
                    structuredAttachments
                    runtimeContext={runtimeContext}
                    deliveryNotices={deliveryNotices}
                    timedRows={timedRows}
                  />
                )}
              </NativeChatWorkerApprovalTimeline>
            </NativeChatHostSetupContext.Provider>
          </NativeChatUsageLimitActionsProvider>
        </NativeChatRowActionsProvider>
      )}
    </NativeChatContextClearFade>
  )
}
