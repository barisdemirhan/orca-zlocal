import { useCallback, useEffect, type RefObject } from 'react'
import type { AgentHubTab } from './agent-hub-keys'
import { useAgentHubOrbPanel } from './agent-hub-orb-panel-store'

export function useAgentHubOrbPanelExclusion({
  restoreFocusRef,
  openRef,
  shownTabRef,
  setOpen,
  openHub
}: {
  restoreFocusRef: RefObject<HTMLElement | null>
  openRef: RefObject<boolean>
  shownTabRef: RefObject<AgentHubTab>
  setOpen: (open: boolean) => void
  openHub: (tab?: AgentHubTab) => void
}): (tab: AgentHubTab) => void {
  const panelOpen = useAgentHubOrbPanel((s) => s.session !== null)
  useEffect(() => {
    if (panelOpen) {
      restoreFocusRef.current = null
      setOpen(false)
    }
  }, [panelOpen, restoreFocusRef, setOpen])
  return useCallback(
    (tab: AgentHubTab) => {
      if (openRef.current && shownTabRef.current === tab) {
        setOpen(false)
        return
      }
      openHub(tab)
    },
    [openHub, openRef, setOpen, shownTabRef]
  )
}
