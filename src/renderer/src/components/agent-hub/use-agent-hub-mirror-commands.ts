import { cycleAgentHubMirrorTab } from './agent-hub-mirror-tab-command'
import { shownAgentHubMirrorTarget, activeAgentHubMirrorTab } from './agent-hub-mirror-membership'
import { releaseAgentHubMirrorShownTarget } from './agent-hub-mirror-viewing'
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
        nextMirrorTab: () => cycleAgentHubMirrorTab(1),
        previousMirrorTab: () => cycleAgentHubMirrorTab(-1),
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
                releaseAgentHubMirrorShownTarget(front.id, tab.id)
                jump(shownAgentHubMirrorTarget(tab))
              }
            }
          : null
      }),
    [commands, canvasOpen, jump]
  )
}
