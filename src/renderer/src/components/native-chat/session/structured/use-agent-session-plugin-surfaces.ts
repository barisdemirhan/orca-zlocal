import { useCallback, useMemo } from 'react'
import { callStructuredAgentSession } from '@/runtime/native-chat/requests/structured-agent-session-call'
import type { RuntimeClientTarget } from '../../../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import type {
  AgentSessionPluginNode,
  AgentSessionPluginPane,
  AgentSessionPluginStatus,
  AgentSessionPluginUiPress
} from '../../../../../../shared/agent-session/plugin-surfaces/agent-session-plugin-surface-wire'
import type { AgentSessionPluginSurfaceState } from '../../../../../../shared/agent-session/plugin-surfaces/agent-session-plugin-surface-state'

export type NativeChatPluginSurfaces = {
  pluginStatuses?: readonly AgentSessionPluginStatus[]
  pluginPromptHint?: AgentSessionPluginNode
  pluginPane?: AgentSessionPluginPane
  /** Fire and forget: the host redraws through a later frame, and a failed press changes nothing. */
  pressPluginUi: (press: AgentSessionPluginUiPress) => void
}

/** What mods drew for this chat, and the way a press on it reaches the host that runs the session. */
export function useAgentSessionPluginSurfaces(
  target: RuntimeClientTarget,
  sessionId: string,
  { plugins }: { plugins?: AgentSessionPluginSurfaceState },
  transportEnabled: boolean
): NativeChatPluginSurfaces {
  const pressPluginUi = useCallback(
    (press: AgentSessionPluginUiPress) => {
      void callStructuredAgentSession(target, 'agentSession.pluginUiPress', {
        sessionId,
        ...press
      }).catch(() => {})
    },
    [target, sessionId]
  )
  const shown = transportEnabled ? plugins : undefined
  return useMemo(
    () => ({
      pluginStatuses: shown?.statuses,
      ...(shown?.promptHint ? { pluginPromptHint: shown.promptHint } : {}),
      ...(shown?.pane ? { pluginPane: shown.pane } : {}),
      pressPluginUi
    }),
    [shown, pressPluginUi]
  )
}
