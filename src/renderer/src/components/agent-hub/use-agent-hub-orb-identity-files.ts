import { useCallback, useEffect, useState } from 'react'
import type { AgentHubOrbIdentityFiles } from '../../../../shared/agent-hub-orb-identity'

export const AGENT_HUB_ORB_MEMORY_CHANGED_EVENT = 'orca:agent-hub-orb-memory-changed'

export function notifyAgentHubOrbMemoryChanged(): void {
  window.dispatchEvent(new Event(AGENT_HUB_ORB_MEMORY_CHANGED_EVENT))
}

/** SOUL.md, USER.md and memory entries; re-read on mount and whenever a memory is written elsewhere. */
export function useAgentHubOrbIdentityFiles() {
  const [files, setFiles] = useState<AgentHubOrbIdentityFiles | null>(null)
  const apply = useCallback((next: AgentHubOrbIdentityFiles): AgentHubOrbIdentityFiles => {
    setFiles(next)
    notifyAgentHubOrbMemoryChanged()
    return next
  }, [])

  useEffect(() => {
    let active = true
    const load = (): void => {
      void window.api.app
        .readAgentHubOrbIdentity()
        .then((next) => {
          if (active) {
            setFiles(next)
          }
        })
        .catch(() => {})
    }
    load()
    window.addEventListener(AGENT_HUB_ORB_MEMORY_CHANGED_EVENT, load)
    return () => {
      active = false
      window.removeEventListener(AGENT_HUB_ORB_MEMORY_CHANGED_EVENT, load)
    }
  }, [])

  return {
    files,
    writeSoul: (text: string) => window.api.app.writeAgentHubOrbSoul(text).then(apply),
    writeUser: (text: string) => window.api.app.writeAgentHubOrbUser(text).then(apply),
    forget: (line: string | null) => window.api.app.forgetAgentHubOrbMemory(line).then(apply)
  }
}
