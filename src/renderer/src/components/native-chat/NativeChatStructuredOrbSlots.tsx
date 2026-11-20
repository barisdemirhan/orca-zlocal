import { useContext, type CSSProperties, type ReactNode } from 'react'
import type { useStructuredAgentSession } from './session/structured/use-structured-agent-session'
import { NativeChatPresentationContext } from './native-chat-presentation-context'
import { NativeChatOrbPromptSlot } from './NativeChatOrbPromptSlot'
import { AgentHubOrbComposerState } from '../agent-hub/AgentHubOrbComposerState'

type Controller = ReturnType<typeof useStructuredAgentSession>

export function NativeChatStructuredPromptSlot({
  pane,
  prompt,
  appearanceStyle,
  children
}: {
  pane: { tabId: string; sessionId: string }
  prompt: { itemId: string } | null
  appearanceStyle: CSSProperties
  children: ReactNode
}): React.JSX.Element {
  return (
    <NativeChatOrbPromptSlot
      tabId={pane.tabId}
      sessionId={pane.sessionId}
      pending={prompt !== null}
      requestId={prompt?.itemId}
      appearanceStyle={appearanceStyle}
    >
      {children}
    </NativeChatOrbPromptSlot>
  )
}

export function NativeChatStructuredComposerState({
  sessionId,
  controller,
  children
}: {
  sessionId: string
  controller: Controller
  children: ReactNode
}): React.JSX.Element {
  return (
    <AgentHubOrbComposerState
      enabled={useContext(NativeChatPresentationContext) === 'orb'}
      sessionId={sessionId}
      items={controller.journalItems}
      prompts={controller.prompts}
      working={controller.isWorking}
      latestTurn={controller.latestTurn}
    >
      {children}
    </AgentHubOrbComposerState>
  )
}
