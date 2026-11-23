import { useMemo } from 'react'
import type { Bot } from '../../../shared/bot-types'
import { useBots } from './bot-catalog'
import { withoutOtherComputersOrbs } from './bot-hosts'

/** `useBots` for a list to pick from or count: other computers' Orbs are left out. */
export function useListedBots(enabled = true): readonly Bot[] {
  const bots = useBots(enabled)
  return useMemo(() => withoutOtherComputersOrbs(bots), [bots])
}
