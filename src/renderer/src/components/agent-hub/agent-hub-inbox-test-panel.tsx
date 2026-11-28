import { AgentHubPanel } from './AgentHubPanel'
import { useAgentHubInboxModel } from './agent-hub-inbox-model'

/** The panel with its Inbox model computed from the same stores, for tests that render it alone. */
export function AgentHubPanelWithInbox(
  props: Omit<React.ComponentProps<typeof AgentHubPanel>, 'inbox'>
): React.JSX.Element {
  const inbox = useAgentHubInboxModel(props.lists, () => false)
  return <AgentHubPanel {...props} inbox={inbox} />
}
