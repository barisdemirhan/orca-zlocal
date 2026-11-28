import { BotServerOutageCard } from '@/components/bots/BotServerOutageCard'
import { useBotForWorkspace } from '@/components/bots/bot-workspace'
import type { NativeChatHostOutage } from '@/components/native-chat/host-access/use-native-chat-host-outage'
import type { Bot } from '../../../../../shared/bot-types'
import { NativeChatBotAskCards } from './NativeChatBotAskCards'

/** A bot's page whose server is down (not stopped on purpose): its recovery card stands in for the
 *  composer. */
export function useNativeChatBotOutage(
  ownerWorktreeId: string | null | undefined,
  hostOutage: NativeChatHostOutage | null
): NativeChatHostOutage | null {
  const pageBot = useBotForWorkspace(ownerWorktreeId ?? null)
  return pageBot !== null && hostOutage?.kind !== 'stopped' ? hostOutage : null
}

/** The bot chat's cards above the composer: its host being down, and the asks waiting on the owner. */
export function NativeChatBotCards({
  bot,
  sessionId,
  outage
}: {
  bot: Bot | null
  sessionId: string
  outage: NativeChatHostOutage | null
}): React.JSX.Element {
  return (
    <>
      {outage ? <BotServerOutageCard key={outage.environmentId} outage={outage} /> : null}
      <NativeChatBotAskCards bot={bot} sessionId={sessionId} />
    </>
  )
}
