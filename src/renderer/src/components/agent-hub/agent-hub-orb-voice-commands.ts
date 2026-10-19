import { useAppStore } from '@/store'
import { isDictationRunning } from './agent-hub-mirror-mic-state'
import { useAgentHubOrbPanel } from './agent-hub-orb-panel-store'
import { readAgentHubOrbVoice } from './agent-hub-orb-voice-context'

export type AgentHubOrbVoiceCommand = 'toggleOrbLive' | 'toggleOrbMicrophone' | 'toggleOrbSpeaker'
export const AGENT_HUB_ORB_VOICE_COMMANDS = {
  toggleOrbLive: () => runAgentHubOrbVoiceCommand('toggleOrbLive'),
  toggleOrbMicrophone: () => runAgentHubOrbVoiceCommand('toggleOrbMicrophone'),
  toggleOrbSpeaker: () => runAgentHubOrbVoiceCommand('toggleOrbSpeaker')
}

export function agentHubOrbVoiceCommandAvailable(command: AgentHubOrbVoiceCommand): boolean {
  const tabId = useAgentHubOrbPanel.getState().session?.tabId
  if (!tabId || isDictationRunning(useAppStore.getState().dictationState)) {
    return false
  }
  const voice = readAgentHubOrbVoice(tabId)?.getSnapshot()
  if (!voice || voice.connection === 'stopping' || voice.connection === 'connecting') {
    return false
  }
  return command === 'toggleOrbLive'
    ? voice.canStart || voice.connection === 'live'
    : voice.connection === 'live'
}

export function runAgentHubOrbVoiceCommand(command: AgentHubOrbVoiceCommand): void {
  if (!agentHubOrbVoiceCommandAvailable(command)) {
    return
  }
  const tabId = useAgentHubOrbPanel.getState().session?.tabId
  const controller = tabId ? readAgentHubOrbVoice(tabId) : null
  if (!controller) {
    return
  }
  const voice = controller.getSnapshot()
  if (command === 'toggleOrbLive') {
    void (voice.connection === 'live' ? controller.switchToText() : controller.startLive())
  } else if (command === 'toggleOrbMicrophone') {
    controller.muteInput(voice.input !== 'muted')
  } else {
    controller.muteOutput(!voice.outputMuted)
  }
}
