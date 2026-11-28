import { useCallback, useMemo, useState } from 'react'
import { useBotHomeWorkspaces, useBots, useBotsEnabled } from '@/lib/bot-catalog'
import { getHostKeyedBotSidebarEntries } from '../bots/bot-sidebar-entry-keys'
import { botMentionServer } from '../bots/bot-mention-server'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host/execution-host'
import type { Bot } from '../../../../shared/bot-types'
import type { FolderWorkspace } from '../../../../shared/folder-workspaces/folder-workspace-types'

// A trailing `@word` at the start or after a space.
const TRIGGER = /(^|\s)@([^\s@]*)$/
const NO_GROUPS: readonly never[] = []

export type AgentHubOrbBotMention = {
  bot: Bot | null
  options: readonly { bot: Bot; home: FolderWorkspace }[]
  active: number
  listOpen: boolean
  pick: (bot: Bot) => void
  clear: () => void
  setActive: (index: number) => void
  /** True when the key was used by the list or the pill. */
  handleKey: (event: React.KeyboardEvent<HTMLInputElement>) => boolean
}

/** `@` in the Orb's quick box lists this computer's bots, then its paired servers', each with its live
 *  state; the pick is a pill sent as a bot mention. */
export function useAgentHubOrbBotMention(
  draft: string,
  setDraft: (value: string) => void
): AgentHubOrbBotMention {
  const enabled = useBotsEnabled()
  const query = TRIGGER.exec(draft)?.[2]
  // Why: the first subscription loads every host's bots; wait until `@` asks for them.
  const listing = enabled && query !== undefined
  const bots = useBots(listing)
  const homes = useBotHomeWorkspaces(bots, NO_GROUPS, listing)
  const [bot, setBot] = useState<Bot | null>(null)
  const [active, setActive] = useState(0)
  const [dismissed, setDismissed] = useState<string | null>(null)
  const listOpen = query !== undefined && dismissed !== draft && bot === null
  const options = useMemo(() => {
    if (query === undefined) {
      return []
    }
    const needle = query.toLowerCase()
    const reachable = getHostKeyedBotSidebarEntries(bots, [], homes).flatMap((entry) =>
      entry.kind === 'bot' &&
      (entry.bot.hostId === LOCAL_EXECUTION_HOST_ID || botMentionServer(entry.bot.hostId)) &&
      entry.bot.name.toLowerCase().includes(needle)
        ? [{ bot: entry.bot, home: entry.home }]
        : []
    )
    const local = reachable.filter((entry) => entry.bot.hostId === LOCAL_EXECUTION_HOST_ID)
    return [...local, ...reachable.filter((entry) => !local.includes(entry))]
  }, [bots, homes, query])
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
