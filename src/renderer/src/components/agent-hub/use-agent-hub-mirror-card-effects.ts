import { useEffect, useEffectEvent, useRef } from 'react'
import type { AgentHubIndicatorKind } from './agent-hub-lists'
import {
  noteAgentHubMirrorTurnStarted,
  openAgentHubMirrorDrawer,
  recordAgentHubMirrorEvent,
  type AgentHubMirrorDrawer
} from './agent-hub-mirror-drawer-store'

/** Notes what happened to the card so an agent that asks can read it back (see events in the store). */
export function useRecordAgentHubMirrorEvents(sourceKey: string): void {
  useEffect(() => {
    recordAgentHubMirrorEvent(sourceKey, { kind: 'card-opened' })
    return () => recordAgentHubMirrorEvent(sourceKey, { kind: 'card-closed' })
  }, [sourceKey])
}

/** A refusal lasts until the agent's next turn: when one starts, the user's close no longer holds. */
export function useNoteAgentHubMirrorTurns(sourceKey: string, kind: AgentHubIndicatorKind): void {
  const previous = useRef(kind)
  useEffect(() => {
    if (kind === 'work' && previous.current !== 'work') {
      noteAgentHubMirrorTurnStarted(sourceKey)
    }
    previous.current = kind
  }, [sourceKey, kind])
}

/** Opens the PR drawer once for each check that newly fails, unless the user closed it or another drawer is up. */
export function useOpenAgentHubMirrorOnFailedCheck(
  sourceKey: string,
  enabled: boolean,
  failedNames: readonly string[],
  shown: AgentHubMirrorDrawer | null
): void {
  const seen = useRef<{ sourceKey: string; names: Set<string> } | null>(null)
  const failedKey = failedNames.join('\0')
  const openForNewFailures = useEffectEvent((): void => {
    const known = seen.current?.sourceKey === sourceKey ? seen.current.names : null
    seen.current = { sourceKey, names: new Set(failedNames) }
    if (known && enabled && shown === null && failedNames.some((name) => !known.has(name))) {
      openAgentHubMirrorDrawer(sourceKey, 'pr', 'auto')
    }
  })
  useEffect(() => {
    openForNewFailures()
  }, [sourceKey, failedKey])
}
