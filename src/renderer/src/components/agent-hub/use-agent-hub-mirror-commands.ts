import { cycleAgentHubMirrorTab } from './agent-hub-mirror-tab-command'
import { shownAgentHubMirrorTarget, activeAgentHubMirrorTab } from './agent-hub-mirror-membership'
import { releaseAgentHubMirrorShownTarget } from './agent-hub-mirror-viewing'
import { useEffect } from 'react'
import { useAppStore } from '@/store'
import { agentHubActiveTarget } from './agent-hub-active-target'
import { registerAgentHubCommands, type AgentHubCommands } from './agent-hub-commands'
import { popOutAgentHubTab } from './agent-hub-tab-popout'
import { readAgentHubMirrors, toggleAgentHubMirrorFocus } from './agent-hub-mirror-store'
import { readAgentHubMirrorFocus } from './agent-hub-mirror-focus'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

export function useAgentHubMirrorCommands(
  commands: Omit<AgentHubCommands, 'focusMirror' | 'popOut' | 'jumpToMirror'>,
  jump: (target: AgentHubPaneTarget) => void
): void {
  useEffect(
    () =>
      registerAgentHubCommands({
        ...commands,
        nextMirrorTab: () => cycleAgentHubMirrorTab(1),
        previousMirrorTab: () => cycleAgentHubMirrorTab(-1),
        // Mirrors focus over the workspace as well as the canvas, so the chord follows any open mirror.
        focusMirror: commands.arrangeMirrors
          ? () => {
              const id = readAgentHubMirrorFocus() ?? readAgentHubMirrors().windows.at(-1)?.id
              if (!id) {
                return
              }
              toggleAgentHubMirrorFocus(id)
              if (readAgentHubMirrorFocus() === id) {
                document
                  .querySelector(`[data-agent-hub-mirror-key="${CSS.escape(id)}"]`)
                  ?.querySelector<HTMLElement>('.xterm-helper-textarea')
                  ?.focus()
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
    [commands, jump]
  )
}
