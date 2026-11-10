import { describe, expect, it } from 'vitest'
import { createTestStore } from '@/store/testing/app-store-test-fixture'

describe('direct terminal status model ownership', () => {
  it.each([undefined, 'claude-opus-5-5'])(
    'keeps the model %s of an active Claude pane when Codex reports through it',
    (model) => {
      const store = createTestStore()
      const paneKey = 'tab:11111111-1111-4111-8111-111111111111'
      store.getState().setAgentStatus(paneKey, {
        state: 'working',
        prompt: 'coordinate',
        agentType: 'claude',
        model
      })
      store.getState().setAgentStatus(paneKey, {
        state: 'working',
        prompt: 'worker',
        agentType: 'codex',
        model: 'gpt-6.1-sol'
      })
      expect(store.getState().agentStatusByPaneKey[paneKey]?.agentType).toBe('claude')
      expect(store.getState().agentStatusByPaneKey[paneKey]?.model).toBe(model)
    }
  )
})
