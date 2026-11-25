import { useMemo } from 'react'
import { useListedBots } from '@/lib/use-listed-bots'
import type { Bot } from '../../../../shared/bot-types'

/** The Orb's own bot on this computer (or the server a paired window uses); null while it has none. */
export function useAgentHubOrbBot(): Bot | null {
  const bots = useListedBots()
  return useMemo(() => bots.find((bot) => bot.role === 'orb') ?? null, [bots])
}
