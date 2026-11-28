import { describe, expect, it } from 'vitest'
import { createHookListenerState } from '../../listener-state'
import { normalizeAndAccept, PANE_KEY } from '../../normalization/agent-hook-listener-test-harness'

describe('Claude notification wait recovery', () => {
  it.each(['url_dialog', 'elicitation_dialog'])(
    'clears a %s without an Elicitation hook only when its owner completes a tool',
    (notificationType) => {
      const state = createHookListenerState()
      const post = (payload: Record<string, unknown>) =>
        normalizeAndAccept(state, 'claude', { session_id: 'root', ...payload })?.payload
      post({ hook_event_name: 'UserPromptSubmit', prompt: 'Task' })
      const owner = { agent_id: 'child', session_id: 'child-session' }
      post({ ...owner, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_use_id: 'tool' })
      expect(
        post({ ...owner, hook_event_name: 'Notification', notification_type: notificationType })
          ?.state
      ).toBe('waiting')
      post({ ...owner, hook_event_name: 'ElicitationResult', mcp_server_name: 'forms' })
      post({ hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_use_id: 'tool' })
      post({
        ...owner,
        session_id: 'stale-child',
        hook_event_name: 'PostToolUse',
        tool_name: 'Bash',
        tool_use_id: 'tool'
      })
      expect(state.lastStatusByPaneKey.get(PANE_KEY)?.payload.state).toBe('waiting')
      expect(
        post({ ...owner, hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_use_id: 'tool' })
          ?.state
      ).toBe('working')
      expect(state.lastStatusByPaneKey.get(PANE_KEY)?.payload.toolInput).toBeUndefined()
    }
  )

  it.each(['PreToolUse', 'PostToolUse'])(
    'clears a cold-listener permission on its main agent next %s',
    (eventName) => {
      const state = createHookListenerState()
      const post = (payload: Record<string, unknown>) =>
        normalizeAndAccept(state, 'claude', { session_id: 'root', ...payload })?.payload
      post({ hook_event_name: 'UserPromptSubmit', prompt: 'Task' })
      expect(
        post({
          hook_event_name: 'Notification',
          notification_type: 'permission_prompt',
          message: 'Allow network?'
        })?.state
      ).toBe('waiting')
      post({ hook_event_name: eventName, agent_id: 'other', tool_name: 'Bash' })
      expect(state.lastStatusByPaneKey.get(PANE_KEY)?.payload.state).toBe('waiting')
      expect(
        post({ hook_event_name: eventName, tool_name: 'Bash', tool_use_id: 'tool-0' })
      ).toMatchObject({ state: 'working', prompt: 'Task' })
      expect(state.lastStatusByPaneKey.get(PANE_KEY)?.payload.toolInput).toBeUndefined()
    }
  )
})
