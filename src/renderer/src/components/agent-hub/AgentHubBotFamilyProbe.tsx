import { useLayoutEffect, useRef } from 'react'
import { activeAgentHubMirrorTab } from './agent-hub-mirror-membership'
import { useAgentHubBotIdentity, type AgentHubBotIdentity } from './agent-hub-bot-identity'
import type { AgentHubMirrorChip as ChipState } from './agent-hub-mirror-store'

/** Tells the tray whose bot a parked chip belongs to; hooks cannot run in the tray's own loop. */
export function AgentHubBotFamilyProbe({
  chip,
  onIdentity
}: {
  chip: ChipState
  onIdentity: (key: string, identity: AgentHubBotIdentity | null) => void
}): null {
  const identity = useAgentHubBotIdentity(activeAgentHubMirrorTab(chip.window).target)
  const key = chip.window.id
  const latest = useRef(identity)
  latest.current = identity
  const botId = identity?.bot.id
  const origin = identity?.origin
  const name = identity?.bot.name
  useLayoutEffect(() => {
    onIdentity(key, latest.current)
  }, [key, botId, origin, name, onIdentity])
  useLayoutEffect(() => () => onIdentity(key, null), [key, onIdentity])
  return null
}
