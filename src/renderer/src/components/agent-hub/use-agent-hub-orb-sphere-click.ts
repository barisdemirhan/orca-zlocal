import { cancelAgentHubOrbLaunch } from './agent-hub-orb-panel-store'
import { dispatchDictationControl } from '../dictation/dictation-control-events'
import { openAgentHubOrbSideAskChat } from './agent-hub-orb-side-chat'
import type { useAgentHubOrbBotBubble } from './use-agent-hub-orb-bot-bubble'
import type { useAgentHubOrbQuickWrite } from './use-agent-hub-orb-quick-write'
import type { agentHubOrbSphereAction } from './agent-hub-orb-sphere-action'

/** What a click on the closed sphere does: open a waiting chat, end dictation, show the asks or the quick box. */
export function useAgentHubOrbSphereClick({
  sessionId,
  tabId,
  sideAskId,
  action,
  hasRequest,
  botBubble,
  quick
}: {
  sessionId: string
  tabId: string | undefined
  sideAskId: string | null
  action: ReturnType<typeof agentHubOrbSphereAction>
  hasRequest: boolean
  botBubble: ReturnType<typeof useAgentHubOrbBotBubble>
  quick: ReturnType<typeof useAgentHubOrbQuickWrite>
}): () => void {
  return () => {
    cancelAgentHubOrbLaunch(sessionId, tabId)
    if (sideAskId && action === 'quick-input' && !hasRequest) {
      openAgentHubOrbSideAskChat(sideAskId)
    } else if (action === 'finish-dictation') {
      if (quick.dictation.active) {
        quick.dictation.stop()
      } else {
        dispatchDictationControl('stop')
      }
    } else if (action === 'quick-input') {
      if (!hasRequest && botBubble.hasAsks && !botBubble.asking) {
        botBubble.openAsk()
      } else {
        botBubble.closeAsk()
        quick.onSphereClick()
      }
    }
  }
}
