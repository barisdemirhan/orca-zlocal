import { describe, expect, it } from 'vitest'
import { normalizeAgentHubDefaultTab } from '../../../../shared/agent-hub-settings'
import { agentHubInitialTab } from './agent-hub-initial-tab'

describe('Agent Hub opening tab', () => {
  it.each(['inbox', 'running', 'agents', 'all'])(
    'preserves stored %s when nobody is waiting',
    (stored) => {
      const tab = normalizeAgentHubDefaultTab(stored)
      expect(tab).toBe(stored)
      expect(agentHubInitialTab(tab, 0)).toBe(stored)
    }
  )
  it.each(['inbox', 'running', 'agents', 'all'])(
    'opens Inbox instead of %s when an agent is waiting',
    (stored) => {
      expect(agentHubInitialTab(normalizeAgentHubDefaultTab(stored), 1)).toBe('inbox')
    }
  )
  it.each([undefined, null, 'unknown', 1, {}])(
    'falls back to Inbox for invalid stored values',
    (stored) => {
      expect(normalizeAgentHubDefaultTab(stored)).toBe('inbox')
    }
  )
})
