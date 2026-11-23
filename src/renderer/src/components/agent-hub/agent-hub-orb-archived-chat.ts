import { activateAiVaultStructuredSession } from '@/lib/agent-session/open/activate-ai-vault-structured-session'
import { useAgentHubOrbPanel } from './agent-hub-orb-panel-store'

/** Opens a floating chat from before the Orb bot as a tab where it ran; the Orb steps back to its sphere. */
export function openArchivedAgentHubOrbChat(sessionId: string, workspaceId: string): void {
  useAgentHubOrbPanel.setState({ presentation: 'orb', compact: false, chatVisible: true })
  void activateAiVaultStructuredSession({ structuredSession: { sessionId, workspaceId } })
}
