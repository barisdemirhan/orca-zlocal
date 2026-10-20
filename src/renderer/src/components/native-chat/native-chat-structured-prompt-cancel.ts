import type { AgentType } from '../../../../shared/agent-status-types'
import type { useStructuredAgentSession } from './use-structured-agent-session'

type StructuredChatController = ReturnType<typeof useStructuredAgentSession>

/** Cancels the turn that raised the pending prompt, pinned to the prompt's revision. */
export function cancelStructuredPrompt(
  prompt: StructuredChatController['prompts'][number] | null,
  controller: Pick<StructuredChatController, 'turnId' | 'cancel'>,
  agent: AgentType
): void {
  if (prompt && (controller.turnId || agent === 'pi')) {
    void controller.cancel(controller.turnId ?? undefined, {
      itemId: prompt.itemId,
      expectedRevision: prompt.revision
    })
  }
}
