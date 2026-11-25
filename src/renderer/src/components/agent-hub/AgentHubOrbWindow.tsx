import type { ReactNode } from 'react'
import type { Bot } from '../../../../shared/bot-types'
import { AgentHubOrbStripBar } from './AgentHubOrbStripBar'
import { AgentHubOrbWindowPane, AgentHubOrbWindowTabRow } from './AgentHubOrbWindowPanes'
import { useAgentHubOrbChatStrip } from './agent-hub-orb-chat-strip-store'
import { useAgentHubOrbChatOpenOverride } from './use-agent-hub-orb-chat-open-override'
import { useAgentHubOrbStripModel } from './use-agent-hub-orb-strip-model'
import type { AgentHubOrbVoiceValue } from './use-agent-hub-orb-voice'

/** The Orb window as a bot page: tabs, the open-chat strip, and the retained chat under them. */
export function AgentHubOrbWindow({
  bot,
  sessionId,
  homeTitle,
  voice,
  chatWaiting,
  onClearHome,
  children
}: {
  bot: Bot
  sessionId: string
  homeTitle: string
  voice: AgentHubOrbVoiceValue
  chatWaiting: boolean
  onClearHome: () => void
  /** The chat's destination div; always mounted, shown on the Chat tab only. */
  children: ReactNode
}): React.JSX.Element {
  const tab = useAgentHubOrbChatStrip((s) => s.windowTab)
  const model = useAgentHubOrbStripModel({ bot, sessionId, homeTitle, voice, onClearHome })
  const override = useAgentHubOrbChatOpenOverride(onClearHome)
  return (
    <>
      <AgentHubOrbWindowTabRow bot={bot} tab={tab} chatWaiting={chatWaiting} />
      {tab === 'chat' ? (
        <AgentHubOrbStripBar model={model} voice={voice} onClearHome={onClearHome} />
      ) : null}
      {children}
      {tab !== 'chat' ? <AgentHubOrbWindowPane bot={bot} tab={tab} override={override} /> : null}
    </>
  )
}
