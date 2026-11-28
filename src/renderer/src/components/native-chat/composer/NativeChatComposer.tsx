import { NativeChatTextAttachmentScope } from '../media/text/NativeChatTextAttachments'
import { forwardRef, useContext } from 'react'
import { AgentHubOrbComposerContext } from '../../agent-hub/agent-hub-orb-composer'
import { AgentHubOrbReadOnlyBar } from '../../agent-hub/AgentHubOrbReadOnlyBar'
import { useAgentHubOrbComposerMode } from '../../agent-hub/use-agent-hub-orb-composer-mode'
import { NativeChatComposerPane } from './NativeChatComposerPane'
import type {
  NativeChatComposerHandle,
  NativeChatComposerProps
} from './native-chat-composer-types'

export const NativeChatComposer = forwardRef<NativeChatComposerHandle, NativeChatComposerProps>(
  function NativeChatComposer(props, ref): React.JSX.Element {
    const orbTabId = useContext(AgentHubOrbComposerContext)
    const orbMode = useAgentHubOrbComposerMode(orbTabId ?? '')
    if (orbTabId && orbMode.kind !== 'none') {
      return <AgentHubOrbReadOnlyBar tabId={orbTabId} />
    }
    return (
      <NativeChatTextAttachmentScope
        key={props.paneKey}
        enabled={Boolean(props.structuredTransport)}
      >
        <NativeChatComposerPane {...props} ref={ref} />
      </NativeChatTextAttachmentScope>
    )
  }
)
