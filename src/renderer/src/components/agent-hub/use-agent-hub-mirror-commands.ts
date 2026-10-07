import { activeAgentHubMirrorTab } from './agent-hub-mirror-membership'
import { closeAgentHubMirrorTab } from './agent-hub-mirror-tab-operations'
import { useEffect } from 'react'
import { useAppStore } from '@/store'
import { agentHubActiveTarget } from './agent-hub-active-target'
import { registerAgentHubCommands, type AgentHubCommands } from './agent-hub-commands'
import { popOutAgentHubTab } from './agent-hub-tab-popout'
import { useAgentHubCanvasOpen } from './agent-hub-canvas-store'
import { readAgentHubMirrors, toggleAgentHubMirrorFocus } from './agent-hub-mirror-store'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

export function useAgentHubMirrorCommands(
  commands: Omit<AgentHubCommands, 'focusMirror' | 'popOut' | 'jumpToMirror'>,
  jump: (target: AgentHubPaneTarget) => void
): void {
  const canvasOpen = useAgentHubCanvasOpen()
  useEffect(
    () =>
      registerAgentHubCommands({
        ...commands,
        focusMirror:
          canvasOpen && commands.arrangeMirrors
            ? () => {
                const front = readAgentHubMirrors().windows.at(-1)
                if (front) {
                  toggleAgentHubMirrorFocus(front.id)
                }
              }
            : null,
        popOut: () => {
          const target = agentHubActiveTarget(useAppStore.getState())
          if (target) {
            popOutAgentHubTab(target)
          }
        },
        jumpToMirror: commands.arrangeMirrors
          ? () => {
              const front = readAgentHubMirrors().windows.at(-1)
              if (front) {
                const tab = activeAgentHubMirrorTab(front)
                closeAgentHubMirrorTab(front.id, tab.id)
                jump(tab.target)
              }
            }
          : null
      }),
    [commands, canvasOpen, jump]
  )
}
