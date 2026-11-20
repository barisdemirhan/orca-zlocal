import type { AgentSessionVoiceEvent } from '../../../../shared/agent-session-voice'

type Transcript = Extract<AgentSessionVoiceEvent, { type: 'transcript' }>

/** Ephemeral captions belong to one assistant item in one Live attempt. */
export class AgentHubOrbVoiceCaptions {
  private itemId: string | null = null
  private text: string | undefined

  constructor(private readonly publish: (caption: string | undefined) => void) {}

  reset(): void {
    this.itemId = null
    this.text = undefined
  }

  accept(event: Transcript): void {
    if (event.role !== 'assistant') {
      if (event.phase === 'started') {
        this.reset()
        this.publish(undefined)
      }
      return
    }
    if (event.phase === 'started') {
      this.itemId = event.itemId
      this.text = event.text?.slice(0, 8192)
    } else if (this.itemId === event.itemId) {
      if (event.text !== undefined) {
        this.text = (event.phase === 'delta' ? (this.text ?? '') + event.text : event.text).slice(
          -8192
        )
      }
      if (event.phase === 'done') {
        this.itemId = null
      }
    } else {
      return
    }
    this.publish(this.text)
  }
}
