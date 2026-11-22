import { useContext, type CSSProperties, type ReactNode } from 'react'
import type { useStructuredAgentSession } from './session/structured/use-structured-agent-session'
import { NativeChatPresentationContext } from './native-chat-presentation-context'
import { NativeChatOrbPromptSlot } from './NativeChatOrbPromptSlot'
import { AgentHubOrbComposerState } from '../agent-hub/AgentHubOrbComposerState'
import { pendingPromptsAllUnanswerableHere } from '../../../../shared/agent-session/requests/prompts/agent-session-approval-subject'

type Controller = ReturnType<typeof useStructuredAgentSession>

/** The Orb answers prompts in its own slot, so for the pane they are not answerable here: the
 *  composer stays and the card never takes focus. */
export function usePromptsUnanswerable(
  prompts: Parameters<typeof pendingPromptsAllUnanswerableHere>[0]
): boolean {
  const orb = useContext(NativeChatPresentationContext) === 'orb'
  return orb || pendingPromptsAllUnanswerableHere(prompts)
}

/** Prompt cards take the composer's slot, below the background-task dock. */
export function PromptSlot({
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

/** The Orb's state for the composer's controls; a context only, so it may wrap the whole input area. */
export function ComposerState({
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
