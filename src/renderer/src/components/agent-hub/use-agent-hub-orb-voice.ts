import { useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useAppStore } from '@/store'
import type { AgentHubOrbSession } from '../../../../shared/agent-hub-orb'
import { AGENT_SESSION_CODEX_VOICE_RUNTIME_CAPABILITY } from '../../../../shared/agent-session-voice'
import { EMPTY_STRUCTURED_AGENT_SESSION } from '../../../../shared/agent-session/view/live-read/structured-agent-session-reducer'
import { createAgentSessionVoiceClient } from '@/runtime/agent-session-voice-client'
import {
  structuredAgentSessionOwnerForTab,
  structuredAgentSessionTargetForHost
} from '@/runtime/native-chat/session-ownership/structured-agent-session-owner'
import {
  structuredAgentSessionHostKey,
  useStructuredAgentSessionHostCapabilityState
} from '@/runtime/native-chat/host-capabilities/structured-agent-session-host-capability'
import { getStructuredAgentSessionReadOwner } from '../native-chat/session/structured/read/structured-agent-session-read-owner'
import { useStructuredAgentSessionMutate } from '../native-chat/session/structured/writes/use-structured-agent-session-mutate'
import { AgentHubOrbVoiceController } from './agent-hub-orb-voice-controller'
import { OrbDictationHold } from './agent-hub-orb-dictation-hold'
import {
  EMPTY_ORB_VOICE_SNAPSHOT,
  type AgentHubOrbVoiceSnapshot
} from './agent-hub-orb-voice-state'
import { registerAgentHubOrbVoice } from './agent-hub-orb-voice-context'
import { isDictationRunning } from './agent-hub-mirror-mic-state'
import { useAgentHubOrbLaunch } from './use-agent-hub-orb-launch'

export type AgentHubOrbVoiceValue = AgentHubOrbVoiceSnapshot &
  Pick<
    AgentHubOrbVoiceController,
    | 'startLive'
    | 'stopLive'
    | 'muteInput'
    | 'muteOutput'
    | 'stopSpeaking'
    | 'switchToText'
    | 'prepareDictation'
  >
const LOCAL_TARGET = { kind: 'local' } as const
const emptySubscribe = (): (() => void) => () => {}
const emptyRead = () => EMPTY_STRUCTURED_AGENT_SESSION
const emptyVoice = () => EMPTY_ORB_VOICE_SNAPSHOT
const nothing = async (): Promise<void> => {}

export function useAgentHubOrbVoice(
  session: AgentHubOrbSession | null,
  visible: boolean
): AgentHubOrbVoiceValue {
  const tab = useAppStore((state) =>
    Object.values(state.unifiedTabsByWorktree)
      .flat()
      .find((entry) => entry.id === session?.tabId)
  )
  const executionHost = useAppStore((state) =>
    tab ? structuredAgentSessionOwnerForTab(state, tab) : null
  )
  const target = useMemo(() => structuredAgentSessionTargetForHost(executionHost), [executionHost])
  const runtimeTarget = target ?? LOCAL_TARGET
  const sessionId = session?.sessionId ?? ''
  const readOwner = useMemo(
    () => (target && sessionId ? getStructuredAgentSessionReadOwner(sessionId, target) : null),
    [sessionId, target]
  )
  const state = useSyncExternalStore(
    readOwner?.subscribe ?? emptySubscribe,
    readOwner ? () => readOwner.getSnapshot().state : emptyRead,
    emptyRead
  )
  const stateRef = useMemo(
    () => ({ current: { fence: readOwner?.getSnapshot().state.fence ?? null } }),
    [readOwner]
  )
  useLayoutEffect(() => {
    stateRef.current.fence = state.fence
  }, [state.fence, stateRef])
  const { write } = useStructuredAgentSessionMutate({
    sessionId,
    target: runtimeTarget,
    stateRef,
    enabled: target !== null && sessionId !== ''
  })
  const hostCapability = useStructuredAgentSessionHostCapabilityState(
    runtimeTarget,
    AGENT_SESSION_CODEX_VOICE_RUNTIME_CAPABILITY
  )
  const tabId = tab?.id
  const agent = tab?.agentSessionAgent
  const selectedEnvironment = useAppStore((app) => app.settings?.activeRuntimeEnvironmentId ?? null)
  const previousEnvironment = useRef(selectedEnvironment)
  const controller = useMemo(() => {
    if (!target || !sessionId || !tabId || !agent) {
      return null
    }
    return new AgentHubOrbVoiceController(
      { sessionId, tabId, agent, hostKey: structuredAgentSessionHostKey(target) },
      createAgentSessionVoiceClient(target, sessionId, write, () =>
        target.kind === 'environment'
          ? useAppStore.getState().runtimeStatusByEnvironmentId.get(target.environmentId)
          : undefined
      ),
      () => {
        const voice = useAppStore.getState().settings?.voice
        return { deviceId: voice?.microphoneDeviceId, label: voice?.microphoneDeviceLabel }
      }
    )
  }, [agent, sessionId, tabId, target, write])
  useEffect(() => {
    if (!controller) {
      return
    }
    const unregister = registerAgentHubOrbVoice(controller)
    return () => {
      controller.setVisible(false)
      unregister()
    }
  }, [controller])
  useEffect(() => controller?.setVisible(visible), [controller, visible])
  useEffect(() => controller?.setHostCapability(hostCapability), [controller, hostCapability])
  useEffect(() => {
    if (previousEnvironment.current !== selectedEnvironment) {
      void controller?.stopLive()
    }
    previousEnvironment.current = selectedEnvironment
  }, [controller, selectedEnvironment])
  const snapshot = useSyncExternalStore(
    controller?.subscribe ?? emptySubscribe,
    controller?.getSnapshot ?? emptyVoice,
    emptyVoice
  )
  useAgentHubOrbLaunch(controller, snapshot, visible)
  const dictating = useAppStore((state) => isDictationRunning(state.dictationState))
  const dictationHold = useMemo(() => controller && new OrbDictationHold(controller), [controller])
  useEffect(() => dictationHold?.update(snapshot, dictating), [dictationHold, snapshot, dictating])
  return useMemo(
    () => ({
      ...snapshot,
      startLive: controller?.startLive ?? nothing,
      stopLive: controller?.stopLive ?? nothing,
      muteInput: controller?.muteInput ?? (() => {}),
      muteOutput: controller?.muteOutput ?? (() => {}),
      stopSpeaking: controller?.stopSpeaking ?? (() => {}),
      switchToText: controller?.switchToText ?? nothing,
      prepareDictation: async () =>
        !isDictationRunning(useAppStore.getState().dictationState) &&
        (await controller?.prepareDictation()) === true
    }),
    [controller, snapshot]
  )
}
