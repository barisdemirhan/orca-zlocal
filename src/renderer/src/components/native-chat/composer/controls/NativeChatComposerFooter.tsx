import type { NativeChatStructuredComposerTransport } from '../submit/native-chat-structured-composer-transport'
import { NativeChatComposerWorkspace } from './NativeChatComposerWorkspace'
import { NativeChatPluginStatusRow } from './NativeChatPluginStatusRow'

export function NativeChatComposerFooter({
  terminalTabId,
  structuredTransport,
  isWorking
}: {
  terminalTabId: string
  structuredTransport?: Pick<
    NativeChatStructuredComposerTransport,
    'worktreeId' | 'runtimeEnvironmentId' | 'pluginStatuses'
  >
  isWorking?: boolean
}): React.JSX.Element {
  return (
    <>
      <NativeChatComposerWorkspace
        terminalTabId={terminalTabId}
        structuredTransport={structuredTransport}
        isWorking={isWorking}
      />
      <NativeChatPluginStatusRow statuses={structuredTransport?.pluginStatuses} />
    </>
  )
}
