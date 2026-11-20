import { useContext, useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { ProviderFrameRow } from '@/components/native-chat/messages/diagnostics/NativeChatProviderDetails'
import { NativeChatPresentationContext } from './native-chat-presentation-context'
import { useNativeChatTranscriptProjection } from './conversation/projection/use-native-chat-transcript-projection'
import type { useNativeChatTurnStatus } from './conversation/turns/use-native-chat-turn-status'
import type { NativeChatTurnStatus } from '../../../../shared/native-chat/transcript/turns/native-chat-turn-status'
import type { NativeChatConnectionWarning } from '../../../../shared/native-chat/transcript/notices/native-chat-provider-frame-summary'
import { nativeChatOrbConversationMessages } from '../../../../shared/native-chat/transcript/notices/native-chat-provider-frame-summary'
import { nativeChatHookErrorSummary } from '../../../../shared/native-chat/transcript/notices/native-chat-provider-frame-summary'

// Orb hides zero-second turn bars; ordinary chat keeps them.
function worthShowing(status: NativeChatTurnStatus): boolean {
  return status.workedSeconds == null || status.workedSeconds >= 1
}

export function useNativeChatOrbPresentation(
  isWorking: boolean,
  ...args: Parameters<typeof useNativeChatTranscriptProjection>
) {
  useTranslation()
  const [session] = args
  const orb = useContext(NativeChatPresentationContext) === 'orb'
  const projection = useNativeChatTranscriptProjection(...args)
  const view = useMemo(
    () => (orb ? nativeChatOrbConversationMessages(projection.messages) : null),
    [orb, projection.messages]
  )
  const messages = view?.messages ?? projection.messages
  return {
    ...projection,
    messages,
    introduction: orb ? (
      <>
        {messages.length === 0 && !isWorking && session.readPhase === 'ready' ? (
          <p className="text-xs text-muted-foreground">
            {translate(
              'auto.agentHub.orb.readyPrompt',
              'Ready. Type, or press the sphere to talk.'
            )}
          </p>
        ) : null}
        {view && view.connectionWarnings.length > 0 ? (
          <NativeChatConnectionWarnings
            key={session.sessionId}
            warnings={view.connectionWarnings}
          />
        ) : null}
      </>
    ) : null,
    presentTurnStatuses: (statuses: ReturnType<typeof useNativeChatTurnStatus>) =>
      orb
        ? {
            ...statuses,
            // A just-settled turn keeps its bar on `active` until the next one starts.
            active: statuses.active && worthShowing(statuses.active) ? statuses.active : null,
            completedByTurn: Object.fromEntries(
              Object.entries(statuses.completedByTurn).filter(([, status]) => worthShowing(status))
            )
          }
        : statuses
  }
}

function NativeChatConnectionWarnings({
  warnings
}: {
  warnings: readonly NativeChatConnectionWarning[]
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const id = useId()
  return (
    <div className="space-y-2 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <span>
          {warnings.length === 1
            ? translate('auto.agentHub.orb.connectionWarning', '1 connection warning')
            : translate('auto.agentHub.orb.connectionWarnings', '{{value0}} connection warnings', {
                value0: warnings.length
              })}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded
            ? translate('auto.agentHub.orb.hideConnectionWarnings', 'Hide')
            : translate('auto.agentHub.orb.showConnectionWarnings', 'Show')}
        </Button>
      </div>
      {expanded ? (
        <div id={id} className="space-y-2">
          {warnings.map(({ id, block }) => (
            <div key={id} className="space-y-1">
              <p className="whitespace-pre-wrap break-words">
                {nativeChatHookErrorSummary(block) ?? block.text}
              </p>
              <ProviderFrameRow
                block={block}
                summary={translate('components.native-chat.notices.details', 'Details')}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
