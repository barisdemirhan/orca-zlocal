import { describe, expect, it } from 'vitest'
import {
  createHookListenerState,
  clearPaneCacheState,
  movePaneCacheState
} from './agent-hook-listener/listener-state'
import {
  normalizeAndAccept,
  PANE_KEY
} from './agent-hook-listener/normalization/agent-hook-listener-test-harness'
import { makePaneKey } from './workspace-layout/stable-pane-id'

describe('provider human notifications', () => {
  it('drops the previous session notification wait when a replacement first reports tool activity', () => {
    const state = createHookListenerState()
    normalizeAndAccept(state, 'claude', {
      hook_event_name: 'UserPromptSubmit',
      session_id: 'old',
      prompt: 'Task'
    })
    normalizeAndAccept(state, 'claude', {
      hook_event_name: 'Notification',
      session_id: 'old',
      notification_type: 'permission_prompt',
      message: 'Approve'
    })
    const next = normalizeAndAccept(state, 'claude', {
      hook_event_name: 'PreToolUse',
      session_id: 'new',
      tool_name: 'Bash',
      tool_use_id: 'new-tool'
    })
    expect(next?.payload.state).toBe('working')
  })
  it('keeps Gemini permission attention through unrelated tool completion without replacing the user prompt', () => {
    const state = createHookListenerState()
    const post = (payload: Record<string, unknown>) =>
      normalizeAndAccept(state, 'gemini', payload)?.payload
    post({ hook_event_name: 'BeforeAgent', session_id: 'session-a', prompt: 'Original task' })
    const notice = post({
      hook_event_name: 'Notification',
      session_id: 'session-a',
      notification_type: 'ToolPermission',
      message: 'Allow shell access?',
      details: { tool_name: 'run_shell_command' }
    })
    expect(notice).toMatchObject({
      state: 'waiting',
      prompt: 'Original task',
      toolInput: 'Allow shell access?'
    })
    expect(notice?.interactivePrompt).toBeUndefined()
    post({ hook_event_name: 'AfterTool', session_id: 'session-a', tool_name: 'read_file' })
    expect(state.lastStatusByPaneKey.get(PANE_KEY)?.payload.state).toBe('waiting')
    expect(post({ hook_event_name: 'AfterAgent', session_id: 'session-a' })?.state).toBe('done')
  })

  it('uses Claude visible permission notification for sandbox network requests and waits for its tool, not a parallel sibling', () => {
    const state = createHookListenerState()
    const post = (payload: Record<string, unknown>) =>
      normalizeAndAccept(state, 'claude', { session_id: 'session-a', ...payload })?.payload
    post({ hook_event_name: 'UserPromptSubmit', prompt: 'Original task' })
    post({
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_use_id: 'network-tool',
      tool_input: { command: 'fetch-example' }
    })
    const notice = post({
      hook_event_name: 'Notification',
      notification_type: 'permission_prompt',
      message: 'Allow network access?'
    })
    expect(notice).toMatchObject({
      state: 'waiting',
      prompt: 'Original task',
      toolInput: 'Allow network access?'
    })
    expect(notice?.interactivePrompt).toBeUndefined()
    post({ hook_event_name: 'PostToolUse', tool_name: 'Read', tool_use_id: 'parallel-tool' })
    expect(state.lastStatusByPaneKey.get(PANE_KEY)?.payload.state).toBe('waiting')
    expect(
      post({ hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_use_id: 'network-tool' })
        ?.state
    ).toBe('working')
  })

  it('opens an MCP form only when visible and closes only on its server result', () => {
    const state = createHookListenerState()
    const post = (payload: Record<string, unknown>) =>
      normalizeAndAccept(state, 'claude', { session_id: 'session-a', ...payload })?.payload
    post({ hook_event_name: 'UserPromptSubmit', prompt: 'Original task' })
    expect(
      post({
        hook_event_name: 'Elicitation',
        mcp_server_name: 'forms',
        message: 'Choose an account'
      })
    ).toBeUndefined()
    expect(state.lastStatusByPaneKey.get(PANE_KEY)?.payload.state).toBe('working')
    const notice = post({
      hook_event_name: 'Notification',
      notification_type: 'elicitation_dialog',
      message: 'Choose an account'
    })
    expect(notice).toMatchObject({
      state: 'waiting',
      prompt: 'Original task',
      toolInput: 'Choose an account'
    })
    expect(notice?.interactivePrompt).toBeUndefined()
    expect(
      post({ hook_event_name: 'ElicitationResult', mcp_server_name: 'other', action: 'accept' })
    ).toBeUndefined()
    expect(state.lastStatusByPaneKey.get(PANE_KEY)?.payload.state).toBe('waiting')
    expect(
      post({ hook_event_name: 'ElicitationResult', mcp_server_name: 'forms', action: 'cancel' })
        ?.state
    ).toBe('working')
  })

  it('preserves a visible question card when its delayed permission notification arrives', () => {
    const state = createHookListenerState()
    normalizeAndAccept(state, 'claude', {
      hook_event_name: 'UserPromptSubmit',
      session_id: 'session-a',
      prompt: 'Task'
    })
    const question = { questions: [{ question: 'Choose?', options: ['A', 'B'] }] }
    normalizeAndAccept(state, 'claude', {
      hook_event_name: 'PreToolUse',
      session_id: 'session-a',
      tool_name: 'AskUserQuestion',
      tool_use_id: 'question',
      tool_input: question
    })
    normalizeAndAccept(state, 'claude', {
      hook_event_name: 'Notification',
      session_id: 'session-a',
      notification_type: 'permission_prompt',
      message: 'Still waiting'
    })
    expect(state.lastStatusByPaneKey.get(PANE_KEY)?.payload.interactivePrompt).toBe(
      JSON.stringify(question)
    )
  })

  it.each([
    {
      name: 'a cancelled turn before the form',
      before: true,
      boundary: { hook_event_name: 'Stop', is_interrupt: true },
      mainAgent: { state: 'done', outcome: 'cancellation' }
    },
    {
      name: 'a cancelled turn while the form is open',
      before: false,
      boundary: { hook_event_name: 'Stop', is_interrupt: true },
      mainAgent: { state: 'done', outcome: 'cancellation' }
    },
    {
      name: 'a failed turn while the form is open',
      before: false,
      boundary: { hook_event_name: 'StopFailure' },
      mainAgent: { state: 'done', outcome: 'failure' }
    },
    {
      name: 'a new main turn while the form is open',
      before: false,
      boundary: { hook_event_name: 'UserPromptSubmit', prompt: 'Next task' },
      mainAgent: { state: 'working' }
    }
  ])(
    'keeps a child form separate from $name and parallel main tools',
    ({ before, boundary, mainAgent }) => {
      const state = createHookListenerState()
      const post = (payload: Record<string, unknown>) =>
        normalizeAndAccept(state, 'claude', { session_id: 'root', ...payload })?.payload
      post({ hook_event_name: 'UserPromptSubmit', prompt: 'Task' })
      if (before) {
        post(boundary)
      }
      const child = { agent_id: 'child', session_id: 'child-session' }
      post({
        ...child,
        hook_event_name: 'PreToolUse',
        tool_name: 'mcp__forms',
        tool_use_id: 'form-tool'
      })
      post({
        ...child,
        hook_event_name: 'Elicitation',
        mcp_server_name: 'forms',
        elicitation_id: 'form-1'
      })
      const notice = post({
        ...child,
        hook_event_name: 'Notification',
        notification_type: 'elicitation_dialog',
        message: 'Account?'
      })
      if (!before) {
        post(boundary)
      }
      expect(notice?.state).toBe('waiting')
      expect(state.lastStatusByPaneKey.get(PANE_KEY)?.payload).toMatchObject({
        state: 'waiting',
        mainAgent,
        toolInput: 'Account?'
      })
      post({ hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_use_id: 'form-tool' })
      expect(state.lastStatusByPaneKey.get(PANE_KEY)?.payload.state).toBe('waiting')
      expect(
        post({
          ...child,
          hook_event_name: 'ElicitationResult',
          mcp_server_name: 'forms',
          elicitation_id: 'old-form',
          action: 'accept'
        })
      ).toBeUndefined()
      expect(
        post({
          ...child,
          hook_event_name: 'ElicitationResult',
          mcp_server_name: 'forms',
          elicitation_id: 'form-1',
          action: 'decline'
        })
      ).toMatchObject({ state: 'working', mainAgent })
      expect(post({ ...child, hook_event_name: 'SubagentStop' })).toMatchObject({
        state: mainAgent.state,
        mainAgent
      })
    }
  )

  it('does not guess the owner of a network prompt while multiple tools are in flight', () => {
    const state = createHookListenerState()
    const post = (payload: Record<string, unknown>) =>
      normalizeAndAccept(state, 'claude', { session_id: 'current', ...payload })?.payload
    post({ hook_event_name: 'UserPromptSubmit', prompt: 'Task' })
    for (const id of ['one', 'two']) {
      post({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_use_id: id })
    }
    post({
      hook_event_name: 'Notification',
      notification_type: 'permission_prompt',
      message: 'Network?'
    })
    for (const id of ['one', 'two']) {
      post({ hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_use_id: id })
    }
    expect(state.lastStatusByPaneKey.get(PANE_KEY)?.payload.state).toBe('waiting')
    expect(post({ hook_event_name: 'Stop' })?.state).toBe('done')
    post({ hook_event_name: 'UserPromptSubmit', session_id: 'replacement', prompt: 'Next' })
    expect(
      post({
        hook_event_name: 'Notification',
        notification_type: 'permission_prompt',
        message: 'Old request'
      })
    ).toBeUndefined()
    expect(state.lastStatusByPaneKey.get(PANE_KEY)?.payload).toMatchObject({
      state: 'working',
      prompt: 'Next'
    })
  })

  it('moves and clears pending human notification context with its pane', () => {
    const state = createHookListenerState()
    normalizeAndAccept(state, 'gemini', {
      hook_event_name: 'BeforeAgent',
      session_id: 'session-a',
      prompt: 'Task'
    })
    normalizeAndAccept(state, 'gemini', {
      hook_event_name: 'Notification',
      session_id: 'session-a',
      notification_type: 'ToolPermission',
      message: 'Approve'
    })
    const moved = makePaneKey('moved', '22222222-2222-4222-8222-222222222222')
    movePaneCacheState(state, PANE_KEY, moved)
    clearPaneCacheState(state, moved)
    normalizeAndAccept(state, 'gemini', {
      hook_event_name: 'BeforeAgent',
      session_id: 'session-b',
      prompt: 'New task'
    })
    expect(
      normalizeAndAccept(state, 'gemini', {
        hook_event_name: 'BeforeTool',
        session_id: 'session-b',
        tool_name: 'read_file'
      })?.payload.state
    ).toBe('working')
  })
})
