import { useCallback, useMemo } from 'react'
import { callStructuredAgentSession } from '@/runtime/native-chat/requests/structured-agent-session-call'
import type { RuntimeClientTarget } from '../../../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import type {
  AgentSessionPluginNode,
  AgentSessionPluginPane,
  AgentSessionPluginStatus,
  AgentSessionPluginUiAction,
  AgentSessionPluginUiPress
} from '../../../../../../shared/agent-session/plugin-surfaces/agent-session-plugin-surface-wire'
import type { AgentSessionPluginSurfaceState } from '../../../../../../shared/agent-session/plugin-surfaces/agent-session-plugin-surface-state'

export type NativeChatPluginSurfaces = {
  pluginStatuses?: readonly AgentSessionPluginStatus[]
  pluginPromptHint?: AgentSessionPluginNode
  pluginPane?: AgentSessionPluginPane
  pluginBand?: AgentSessionPluginNode
  /** Fire and forget: the host redraws through a later frame, and a failed action changes nothing. */
  actOnPluginUi: (action: AgentSessionPluginUiAction) => void
  pressPluginUi: (press: AgentSessionPluginUiPress) => void
}

/** What mods drew for this chat, and the way presses and the chat's size reach the host that runs the session. */
export function useAgentSessionPluginSurfaces(
  target: RuntimeClientTarget,
  sessionId: string,
  { plugins }: { plugins?: AgentSessionPluginSurfaceState },
  transportEnabled: boolean
): NativeChatPluginSurfaces {
  const actOnPluginUi = useCallback(
    (action: AgentSessionPluginUiAction) => {
      void callStructuredAgentSession(target, 'agentSession.pluginUiAction', {
        sessionId,
        action
      }).catch(() => {})
    },
    [target, sessionId]
  )
  const pressPluginUi = useCallback(
    (press: AgentSessionPluginUiPress) => actOnPluginUi({ kind: 'press', ...press }),
    [actOnPluginUi]
  )
  const shown = transportEnabled ? plugins : undefined
  return useMemo(
    () => ({
      pluginStatuses: shown?.statuses,
      ...(shown?.promptHint ? { pluginPromptHint: shown.promptHint } : {}),
      ...(shown?.pane ? { pluginPane: shown.pane } : {}),
      ...(shown?.band ? { pluginBand: shown.band } : {}),
      actOnPluginUi,
      pressPluginUi
    }),
    [shown, actOnPluginUi, pressPluginUi]
  )
}
