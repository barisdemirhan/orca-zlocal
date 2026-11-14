import type { HandlerGroup } from '../dispatch/handler-group-manifest'

export const AGENT_HUB_HANDLER_GROUP: HandlerGroup = {
  name: 'agent-hub',
  keys: [
    'hub notify',
    'hub peek',
    'hub peek close',
    'hub peek back',
    'hub ask',
    'hub orb remember',
    'hub progress',
    'hub presence',
    'hub status',
    'hub questions',
    'hub answer',
    'hub mirror open',
    'hub mirror add',
    'hub mirror minimize',
    'hub mirror restore',
    'hub mirror close',
    'hub arrange',
    'hub canvas open',
    'hub canvas close'
  ],
  load: async () => ({
    ...(await import('./agent-hub.js')).AGENT_HUB_HANDLERS,
    ...(await import('./agent-hub-questions.js')).AGENT_HUB_QUESTION_HANDLERS
  })
}
