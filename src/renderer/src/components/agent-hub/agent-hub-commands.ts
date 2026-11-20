export type AgentHubCommands = {
  openAnswerQueue?: (() => void) | null
  toggleOrb?: (() => void) | null
  toggleOrbLive?: (() => void) | null
  toggleOrbMicrophone?: (() => void) | null
  toggleOrbSpeaker?: (() => void) | null
  toggleOrbConversation?: (() => void) | null
  nextMirrorTab?: (() => void) | null
  previousMirrorTab?: (() => void) | null
  focusMirror: (() => void) | null
  popOut: (() => void) | null
  jumpToMirror: (() => void) | null
  toggle: () => void
  jumpToNextWaiting: () => void
  /** Sends the open mirrors to the hub, or brings the parked ones back when none are open. */
  toggleMirrors: () => void
  /** Opens or leaves the canvas; null while the canvas setting is off, so the chord falls through. */
  toggleCanvas: (() => void) | null
  /** Lays the floating windows out again in the default layout; null while no mirror is open. */
  arrangeMirrors: (() => void) | null
}

// Why a registry: the hub lives in the status bar, so its chords must fall through
// (not be swallowed) whenever the experiment is off or the status bar is hidden.
let registeredCommands: AgentHubCommands | null = null
let answerQueueCommand: (() => void) | null = null

export function registerAgentHubAnswerQueueCommand(command: (() => void) | null): () => void {
  answerQueueCommand = command
  return () => {
    if (answerQueueCommand === command) {
      answerQueueCommand = null
    }
  }
}

export function registerAgentHubCommands(commands: AgentHubCommands): () => void {
  registeredCommands = commands
  return () => {
    if (registeredCommands === commands) {
      registeredCommands = null
    }
  }
}

export function getAgentHubCommands(): AgentHubCommands | null {
  return registeredCommands ? { ...registeredCommands, openAnswerQueue: answerQueueCommand } : null
}
