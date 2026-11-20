import type { Translate } from '@/i18n/use-translate'
import { useContext } from 'react'
import { translate } from '@/i18n/i18n'
import {
  isCodexMcpStartupNotice,
  nativeChatApprovedReviewSummary,
  nativeChatCodexApiErrorSummary,
  nativeChatHookErrorSummary
} from '../../../../../../shared/native-chat/transcript/notices/native-chat-provider-frame-summary'
import { NativeChatPresentationContext } from '../../native-chat-presentation-context'
import { agentSessionGoalControlWords } from '../../session/goals/agent-session-goal-control-words'
import { agentSessionRestartNoteText } from './agent-session-restart-note-text'
import { ProviderFrameRow } from '../diagnostics/NativeChatProviderDetails'
import type { NativeChatTextBlock } from '../../../../../../shared/native-chat/native-chat-types'

/** The Orb's replacement for a notice row: null hides it, undefined leaves the regular row. */
function nativeChatOrbNoticeRow(block: NativeChatTextBlock): React.JSX.Element | null | undefined {
  if (nativeChatApprovedReviewSummary(block)) {
    return null
  }
  if (isCodexMcpStartupNotice(block)) {
    return (
      <ProviderFrameRow
        block={block}
        summary={translate(
          'components.native-chat.notices.mcpStartupDetails',
          'MCP connection details'
        )}
      />
    )
  }
  return undefined
}

function nativeChatOrbNoticeText(block: NativeChatTextBlock): string | null {
  return nativeChatHookErrorSummary(block) ?? nativeChatCodexApiErrorSummary(block)
}

/** What the Orb changes about a notice; undefined `row` leaves the regular row. */
export function useNativeChatOrbNotice(block: NativeChatTextBlock): {
  row: React.JSX.Element | null | undefined
  noteText: (text: string, t: Translate) => string
} {
  const orb = useContext(NativeChatPresentationContext) === 'orb'
  return {
    row: orb ? nativeChatOrbNoticeRow(block) : undefined,
    noteText: (text, t) =>
      (orb ? (nativeChatOrbNoticeText(block) ?? undefined) : undefined) ??
      agentSessionRestartNoteText(text, t) ??
      agentSessionGoalControlWords(text)
  }
}
