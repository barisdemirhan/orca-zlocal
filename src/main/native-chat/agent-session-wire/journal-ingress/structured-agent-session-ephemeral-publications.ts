import type {
  AgentSessionPluginSurfaceUpdate,
  AgentSessionPromptSuggestion,
  AgentSessionTurnActivity
} from '../../../../shared/agent-session/agent-session-wire'
import type { StructuredAgentSessionSinkQueue } from './structured-agent-session-event-sink-queue'

/** State readers see but the journal never keeps; a newer value replaces one still buffered. */
export function structuredAgentSessionEphemeralPublications(
  queue: Pick<StructuredAgentSessionSinkQueue, 'submit'>
): {
  setActivity: (activity: AgentSessionTurnActivity | null) => void
  setPromptSuggestion: (suggestion: AgentSessionPromptSuggestion | null) => void
  setPluginSurfaces: (update: AgentSessionPluginSurfaceUpdate) => void
} {
  return {
    setActivity: (activity) => {
      queue.submit({
        bytes: Buffer.byteLength(JSON.stringify(activity), 'utf8') + 64,
        publicationKey: 'turn-activity',
        run: (bound) => bound.publish(activity)
      })
    },
    setPromptSuggestion: (suggestion) => {
      queue.submit({
        bytes: Buffer.byteLength(JSON.stringify(suggestion), 'utf8') + 64,
        publicationKey: 'prompt-suggestion',
        run: (bound) => bound.publishPromptSuggestion?.(suggestion)
      })
    },
    setPluginSurfaces: (update) => {
      queue.submit({
        bytes: Buffer.byteLength(JSON.stringify(update), 'utf8') + 64,
        // A key per toast: coalescing by one shared key would drop all but the newest.
        publicationKey: update.toast ? `plugin-toast:${update.toast.id}` : 'plugin-statuses',
        run: (bound) => bound.publishPluginSurfaces?.(update)
      })
    }
  }
}
