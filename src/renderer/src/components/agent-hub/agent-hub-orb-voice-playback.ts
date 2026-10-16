import type { AgentSessionVoiceEvent } from '../../../../shared/agent-session-voice'

type TranscriptEvent = Extract<AgentSessionVoiceEvent, { type: 'transcript' }>

export class AgentHubOrbVoicePlayback {
  private inputGeneration = 0
  private inputHasText = false
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
      if (event.phase === 'started') {
        if (this.inputs.has(event.itemId)) {
          return
        }
        this.inputs.add(event.itemId)
        this.activeInput = event.itemId
        this.inputGeneration += 1
        this.inputHasText = false
        this.releaseEligible = true
        for (const item of this.assistantItems) {
          this.suppressedItems.add(item)
        }
        this.setOutput(false)
      }
      if (this.activeInput === event.itemId) {
        this.inputHasText ||= event.hasText
      }
      return
    }
    this.assistantItems.add(event.itemId)
    if (event.phase === 'done') {
      return
    }
    if (event.phase !== 'delta' || !event.hasText) {
      return
    }
    if (!this.assistantGenerations.has(event.itemId)) {
      this.assistantGenerations.set(event.itemId, this.inputGeneration)
    }
    if (
      !this.releaseEligible ||
      !this.inputHasText ||
      this.suppressedItems.has(event.itemId) ||
      this.assistantGenerations.get(event.itemId) !== this.inputGeneration
    ) {
      return
    }
    this.setOutput(true)
  }
}
