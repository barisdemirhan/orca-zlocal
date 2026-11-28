import type { TerminalTab } from '../../../../../shared/workspace-layout/terminal-tab-types'
import { CliChatResumeMenuItems } from './CliChatResumeMenuItems'
import { NativeChatCliForkMenuItems } from './NativeChatCliForkMenuItems'
import type { NativeChatTabSession } from './tab-session-history-switch'

export function TabSessionSurfaceSwitchMenuItems(props: {
  tab: Pick<TerminalTab, 'id' | 'worktreeId'>
  nativeChat?: NativeChatTabSession
  leadingSeparator: boolean
  onComplete?: () => void
  fromMirror?: boolean
  chatBlockedReason?: string
}): React.JSX.Element | null {
  const { chatBlockedReason, fromMirror, ...shared } = props
  return props.nativeChat ? (
    <NativeChatCliForkMenuItems
      {...shared}
      nativeChat={props.nativeChat}
      fromMirror={fromMirror}
      blockedReason={chatBlockedReason}
    />
  ) : (
    <CliChatResumeMenuItems {...shared} />
  )
}
