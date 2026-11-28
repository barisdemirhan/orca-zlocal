import { useState } from 'react'
import { translate } from '@/i18n/i18n'
import { isImeOwnedKeyboardEvent } from '@/lib/text-input/ime/ime-composition-keyboard-event'
import { formatAgentTypeLabel } from '../../../../shared/agent-status/presentation/agent-type-label'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import { replyToFinishedAgent } from './agent-hub-result-reply'

/** One line under a finished result: Enter sends it to that agent, Esc closes. */
export function AgentHubResultReplyInput({
  thread,
  onDone,
  onCancel
}: {
  thread: AgentPaneThread
  onDone: () => void
  onCancel: () => void
}): React.JSX.Element {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const placeholder = translate('agentHub.inbox.replyTo', 'Reply to {{name}}…', {
    name: formatAgentTypeLabel(thread.agentType)
  })
  return (
    <input
      autoFocus
      value={text}
      disabled={sending}
      placeholder={placeholder}
      aria-label={placeholder}
      onChange={(event) => setText(event.target.value)}
      onKeyDown={(event) => {
        // Why: the panel owns the arrow and letter keys; typing here must not reach it.
        event.stopPropagation()
        if (isImeOwnedKeyboardEvent(event)) {
          return
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          onCancel()
        } else if (event.key === 'Enter' && text.trim() !== '') {
          event.preventDefault()
          setSending(true)
          void replyToFinishedAgent(thread, text).then((sent) => {
            setSending(false)
            if (sent) {
              onDone()
            }
          })
        }
      }}
      className="mr-2 mb-2 ml-6 min-w-0 rounded-lg border border-foreground/[0.08] bg-background/60 px-2.5 py-1 text-[13px] outline-none placeholder:text-muted-foreground/70 focus:border-foreground/20"
    />
  )
}
