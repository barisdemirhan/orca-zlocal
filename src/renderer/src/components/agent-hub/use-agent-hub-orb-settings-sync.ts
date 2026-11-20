import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store'
import { normalizeAgentHubOrbSettings } from '../../../../shared/agent-hub-orb-settings'
import { openAgentHubOrb } from './agent-hub-orb-open'
import { useAgentHubOrbPanel } from './agent-hub-orb-panel-store'

export function useAgentHubOrbSettingsSync(open: boolean): void {
  const selection = useAppStore((state) => {
    const settings = normalizeAgentHubOrbSettings(state.settings ?? {})
    return JSON.stringify([settings.agent, settings.model, settings.permission])
  })
  const observed = useRef(selection)
  const generation = useRef(0)
  const pending = useRef(Promise.resolve())
  useEffect(() => {
    const changed = observed.current !== selection
    observed.current = selection
    const issued = ++generation.current
    if (!changed || !open) {
      return
    }
    // Model text edits settle before asking the host to replace an idle conversation.
    let active = true
    const timer = setTimeout(() => {
      pending.current = pending.current.then(async () => {
        if (!active || issued !== generation.current || !useAgentHubOrbPanel.getState().session) {
          return
        }
        await openAgentHubOrb(undefined, true)
      })
    }, 250)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [selection, open])
}
