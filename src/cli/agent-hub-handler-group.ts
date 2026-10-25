import type { HandlerGroup } from './handler-group-manifest'

export const AGENT_HUB_HANDLER_GROUP: HandlerGroup = {
  name: 'agent-hub',
  keys: [
    'hub notify',
    'hub peek',
    'hub ask',
    'hub orb remember',
    'hub progress',
    'hub presence',
    'hub status',
    'hub mirror open',
    'hub mirror add',
    'hub mirror minimize',
    'hub mirror restore',
    'hub mirror close',
    'hub arrange',
    'hub canvas open',
    'hub canvas close'
  ],
  load: async () => (await import('./handlers/agent-hub.js')).AGENT_HUB_HANDLERS
}
