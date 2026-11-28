import { translate } from '@/i18n/i18n'
import { openAgentHubOrbSideAskChat } from './agent-hub-orb-side-chat'

/** Beside the sphere while a side chat asks: names the chat; a click opens it in the Orb window. */
export function AgentHubOrbSideAskCard({
  chat
}: {
  chat: { id: string; title: string }
}): React.JSX.Element {
  return (
    <button
      type="button"
      data-agent-hub-orb-side-ask
      onClick={() => openAgentHubOrbSideAskChat(chat.id)}
      className="w-full cursor-pointer rounded-xl border border-agent-question/45 bg-popover px-3 py-2 text-left text-[13px] shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <b className="block truncate">
        {chat.title || translate('agentHub.orb.strip.newChat', 'New chat')}
      </b>
      <span className="block text-xs text-muted-foreground">
        {translate('agentHub.orb.sideAsk.hint', '1 question · opens that chat')}
      </span>
    </button>
  )
}
