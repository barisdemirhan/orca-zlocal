import { useEffect } from 'react'
import { useAppStore } from '@/store'
import { agentHubActiveTarget } from './agent-hub-active-target'
import { registerAgentHubCommands, type AgentHubCommands } from './agent-hub-commands'
import { popOutAgentHubTab } from './agent-hub-tab-popout'
import { useAgentHubCanvasOpen } from './agent-hub-canvas-store'
import {
  closeAgentHubMirror,
  readAgentHubMirrors,
  toggleAgentHubMirrorFocus
} from './agent-hub-mirror-store'
import { agentHubPaneTargetKey, type AgentHubPaneTarget } from './agent-hub-pane-target'

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
                  toggleAgentHubMirrorFocus(agentHubPaneTargetKey(front))
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
                closeAgentHubMirror(agentHubPaneTargetKey(front))
                jump(front)
              }
            }
          : null
      }),
    [commands, canvasOpen, jump]
  )
}
