import { useCallback, useEffect, useMemo, useState } from 'react'
import { useBots, useBotsEnabled } from '@/lib/bot-catalog'
import { botRefKey } from '@/lib/bot-hosts'
import { refreshBotPurposes, useKnownBotPurposes } from '../bots/use-bot-purposes'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host/execution-host'
import type { Bot } from '../../../../shared/bot-types'

// A trailing `@word` at the start or after a space.
const TRIGGER = /(^|\s)@([^\s@]*)$/

export type AgentHubOrbBotMention = {
  bot: Bot | null
  options: readonly { bot: Bot; purpose: string | undefined }[]
  active: number
  listOpen: boolean
  pick: (bot: Bot) => void
  clear: () => void
  setActive: (index: number) => void
  /** True when the key was used by the list or the pill. */
  handleKey: (event: React.KeyboardEvent<HTMLInputElement>) => boolean
}

/** `@` in the Orb's quick box lists this computer's bots; the pick is a pill sent as a bot mention. */
export function useAgentHubOrbBotMention(
  draft: string,
  setDraft: (value: string) => void
): AgentHubOrbBotMention {
  const enabled = useBotsEnabled()
  const bots = useBots(enabled)
  const purposes = useKnownBotPurposes()
  const [bot, setBot] = useState<Bot | null>(null)
  const [active, setActive] = useState(0)
  const [dismissed, setDismissed] = useState<string | null>(null)
  const query = TRIGGER.exec(draft)?.[2]
  const listOpen = query !== undefined && dismissed !== draft && bot === null
  useEffect(() => {
    if (listOpen) {
      void refreshBotPurposes()
    }
  }, [listOpen])
  const options = useMemo(() => {
    if (query === undefined) {
      return []
    }
    const needle = query.toLowerCase()
    return bots
      .filter(
        (entry) =>
          entry.hostId === LOCAL_EXECUTION_HOST_ID && entry.name.toLowerCase().includes(needle)
      )
      .map((entry) => ({ bot: entry, purpose: purposes.get(botRefKey(entry)) }))
  }, [bots, purposes, query])
  const index = Math.min(active, Math.max(options.length - 1, 0))
  const pick = useCallback(
    (entry: Bot): void => {
      setBot(entry)
      setActive(0)
      setDraft(draft.replace(TRIGGER, '$1').trimEnd())
    },
    [draft, setDraft]
  )
  const clear = useCallback((): void => setBot(null), [])
  const handleKey = (event: React.KeyboardEvent<HTMLInputElement>): boolean => {
    if (event.nativeEvent.isComposing) {
      return false
    }
    if (listOpen && options.length > 0) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const step = event.key === 'ArrowDown' ? 1 : -1
        setActive((index + step + options.length) % options.length)
        return true
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        pick(options[index].bot)
        return true
      }
    }
    if (listOpen && event.key === 'Escape') {
      setDismissed(draft)
      return true
    }
    if (bot && event.key === 'Backspace' && event.currentTarget.value === '') {
      setBot(null)
      return true
    }
    return false
  }
  return {
    bot,
    options,
    active: index,
    listOpen: listOpen && options.length > 0,
    pick,
    clear,
    setActive,
    handleKey
  }
}
