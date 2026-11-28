import type { ComponentProps } from 'react'
import type { Bot } from '../../../../shared/bot-types'
import { AgentHubOrbConversationHeader } from './AgentHubOrbConversationHeader'
import { AgentHubOrbBotFace } from './AgentHubOrbBotFace'
import { AgentHubOrbMoreMenu } from './AgentHubOrbMoreMenu'
import type { AgentHubOrbSphereProps } from './AgentHubOrbSphere'

type HeaderProps = Omit<
  ComponentProps<typeof AgentHubOrbConversationHeader>,
  'face' | 'moreMenu' | 'onNew'
>

/** The Orb window's header: the Orb's face and the ⋯ menu when it is a bot page. */
export function AgentHubOrbWindowHeader({
  bot,
  sphere,
  name,
  actions,
  onClearHome,
  ...header
}: HeaderProps & {
  bot: Bot | null
  sphere: AgentHubOrbSphereProps
  name: string
  actions: { onNew: () => void; onOpenPage: () => void; onBotSettings: () => void }
  onClearHome: () => void
}): React.JSX.Element {
  return (
    <AgentHubOrbConversationHeader
      {...header}
      onNew={actions.onNew}
      face={bot ? <AgentHubOrbBotFace bot={bot} sphere={sphere} size={30} /> : undefined}
      moreMenu={
        bot ? (
          <AgentHubOrbMoreMenu
            name={name}
            busy={header.busy}
            botPage
            onNew={actions.onNew}
            onClearHome={onClearHome}
            onOpenPage={actions.onOpenPage}
            onBotSettings={actions.onBotSettings}
            onHistory={header.onHistory}
            onOrbSettings={header.onSettings}
            onSleep={header.onSleep}
          />
        ) : undefined
      }
    />
  )
}
