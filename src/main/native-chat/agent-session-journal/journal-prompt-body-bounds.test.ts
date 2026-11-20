import { expect, it } from 'vitest'
import { AgentJournalItemBodySchema } from '../../../shared/agent-session/journal/agent-session-journal-schemas'
import { boundJournalPromptBody } from './item-lifecycle/journal-prompt-body-bounds'

it.each([undefined, 'allow_once', 'allow_always', 'future_permission_kind'])(
  'retains permission scope %s through bounded journal serialization',
  (permissionKind) => {
    const body = boundJournalPromptBody({
      kind: 'approval',
      title: 'Command?',
      detail: null,
      options: [
        {
          id: 'opaque',
          label: 'Allow',
          ...(permissionKind === undefined ? {} : { permissionKind })
        }
      ],
      resolution: { state: 'pending', selectedOptionId: null, resolvedBy: null, resolvedAt: null }
    })
    const reloaded = AgentJournalItemBodySchema.parse(JSON.parse(JSON.stringify(body)))
    expect(reloaded).toEqual(body)
    if (reloaded.kind !== 'approval') {
      throw new Error('Expected approval')
    }
    const option = reloaded.options[0]
    if (!option || typeof option === 'string') {
      throw new Error('Expected structured option')
    }
    expect(option.permissionKind).toBe(permissionKind)
  }
)
