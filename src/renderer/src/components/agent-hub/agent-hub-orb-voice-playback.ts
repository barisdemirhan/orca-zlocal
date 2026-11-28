import type { AgentSessionVoiceEvent } from '../../../../shared/agent-session-voice'

type TranscriptEvent = Extract<AgentSessionVoiceEvent, { type: 'transcript' }>

export class AgentHubOrbVoicePlayback {
  private inputGeneration = 0
  private receivedSpeech = false
  private releaseEligible = false
  private activeInput: string | null = null
  private readonly inputs = new Set<string>()
  private readonly assistantItems = new Set<string>()
  private readonly assistantGenerations = new Map<string, number>()
  private readonly suppressedItems = new Set<string>()

  constructor(private readonly setOutput: (enabled: boolean) => void) {}

  suppress(): void {
    this.releaseEligible = false
    for (const item of this.assistantItems) {
      this.suppressedItems.add(item)
    }
    this.setOutput(false)
  }

  accept(event: TranscriptEvent): void {
    if (event.role === 'user') {
      if (!this.receivedSpeech) {
        this.acceptInput(event.phase, event.itemId)
      }
      return
    }
    this.assistantItems.add(event.itemId)
    if (event.phase === 'done') {
      return
    }
    if (!this.assistantGenerations.has(event.itemId)) {
      this.assistantGenerations.set(event.itemId, this.inputGeneration)
    }
    if (
      !this.releaseEligible ||
      this.suppressedItems.has(event.itemId) ||
      this.assistantGenerations.get(event.itemId) !== this.inputGeneration
    ) {
      return
    }
    this.setOutput(true)
  }

  inputSpeech(phase: 'started' | 'stopped', itemId: string): void {
    this.receivedSpeech = true
    if (!this.inputs.has(itemId)) {
      this.acceptInput('started', itemId)
    }
    this.acceptInput(phase === 'stopped' ? 'done' : 'started', itemId)
  }

  private acceptInput(phase: TranscriptEvent['phase'], itemId: string): void {
    if (phase === 'started') {
      if (this.inputs.has(itemId)) {
        return
      }
      this.inputs.add(itemId)
      this.activeInput = itemId
      this.inputGeneration += 1
      this.releaseEligible = true
      for (const item of this.assistantItems) {
        this.suppressedItems.add(item)
      }
      this.setOutput(false)
    } else if (phase === 'done' && this.activeInput === itemId && this.releaseEligible) {
      this.setOutput(true)
    }
  }
}
