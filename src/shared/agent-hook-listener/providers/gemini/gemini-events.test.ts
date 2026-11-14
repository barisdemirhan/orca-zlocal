import { describe, expect, it } from 'vitest'
import { normalizeAndAccept, PANE_KEY } from '../../normalization/agent-hook-listener-test-harness'
import { createHookListenerState } from '../../listener-state'

describe('Gemini permission notifications', () => {
  it.each(['BeforeTool', 'AfterTool', 'PreToolUse', 'PostToolUse'])(
    'resumes on %s without a tool call id, preserving session and tool ownership',
    (eventName) => {
      const state = createHookListenerState()
      const post = (payload: Record<string, unknown>) =>
        normalizeAndAccept(state, 'gemini', { session_id: 'current', ...payload })?.payload
      post({ hook_event_name: 'BeforeAgent', prompt: 'Check the project' })
      post({
        hook_event_name: 'Notification',
        notification_type: 'ToolPermission',
        message: 'Allow shell access?',
        details: { tool_name: 'run_shell_command' }
      })
      expect(post({ hook_event_name: eventName, tool_name: 'read_file' })).toBeUndefined()
      expect(
        post({
          hook_event_name: eventName,
          session_id: 'old',
          tool_name: 'run_shell_command'
        })
      ).toBeUndefined()
      expect(state.lastStatusByPaneKey.get(PANE_KEY)?.payload.state).toBe('waiting')
      expect(
        post({
          hook_event_name: eventName,
          tool_name: 'run_shell_command',
          tool_input: { command: 'pwd' }
        })
      ).toMatchObject({ state: 'working', prompt: 'Check the project', toolInput: 'pwd' })
      expect(post({ hook_event_name: 'AfterTool', tool_name: 'read_file' })?.state).toBe('working')
    }
  )

  it.each(['BeforeTool', 'AfterTool'])(
    'resumes on the next %s when the notification has no tool name',
    (eventName) => {
      const state = createHookListenerState()
      const post = (payload: Record<string, unknown>) =>
        normalizeAndAccept(state, 'gemini', { session_id: 'current', ...payload })?.payload
      post({ hook_event_name: 'BeforeAgent', prompt: 'Check the project' })
      post({
        hook_event_name: 'Notification',
        notification_type: 'ToolPermission',
        message: 'Allow tool execution?'
      })
      expect(post({ hook_event_name: eventName, tool_name: 'read_file' })?.state).toBe('working')
    }
  )
})
