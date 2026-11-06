import { useContext } from 'react'
import { Mic } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { NativeChatMessage } from '../../../../shared/native-chat/native-chat-types'
import { NativeChatPresentationContext } from './native-chat-presentation-context'

export function NativeChatSpokenLabel({
  message
}: {
  message: NativeChatMessage
}): React.JSX.Element | null {
  const presentation = useContext(NativeChatPresentationContext)
  if (presentation !== 'orb' || !message.spoken) {
    return null
  }
  const label = translate('components.native-chat.spokenMessage', 'Spoken message')
  return (
    <span
      role="img"
      aria-label={label}
      data-native-chat-find-skip
      className="inline-flex items-center gap-1 text-xs text-muted-foreground"
    >
      <Mic className="size-3" aria-hidden />
      <span aria-hidden>{label}</span>
    </span>
  )
}
