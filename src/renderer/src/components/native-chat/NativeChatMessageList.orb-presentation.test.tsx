// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render as renderBase, screen, within } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest'
import { AGENT_HUB_ORB_OPENING_PROMPT } from '../../../../shared/agent-hub-orb'
import type {
  NativeChatMessage,
  NativeChatTextBlock
} from '../../../../shared/native-chat/native-chat-types'
import type { NativeChatSettledTurns } from '../../../../shared/native-chat/transcript/native-chat-turn-status'
import { NativeChatMessageList } from './NativeChatMessageList'
import { NativeChatPresentationContext } from './native-chat-presentation-context'
import { installNativeChatMessageListTestViewport } from './viewport/virtualization/native-chat-message-list-test-viewport'
import type { NativeChatLiveSession } from './session/terminal/read/native-chat-live-session-contract'
import { TooltipProvider } from '@/components/ui/tooltip'

const render = (ui: React.ReactElement) => renderBase(ui, { wrapper: TooltipProvider })

let restoreViewport = (): void => {}
beforeAll(() => {
  restoreViewport = installNativeChatMessageListTestViewport()
})
afterAll(() => restoreViewport())
afterEach(cleanup)

function message(id: string, role: NativeChatMessage['role'], text: string): NativeChatMessage {
  return { id, role, blocks: [{ type: 'text', text }], timestamp: 1, source: 'transcript' }
}

function notice(id: string, kind: string, text: string, payload: unknown): NativeChatMessage {
  const head = JSON.stringify(payload)
  const block: NativeChatTextBlock = {
    type: 'text',
    text,
    tone: kind === 'notification:warning' ? 'warning' : 'error',
    providerFrame: {
      provider: 'codex',
      kind,
      payload: { head, byteLength: head.length, digest: id, truncated: false }
    }
  }
  return { ...message(id, 'system', text), blocks: [block] }
}

function conversation(
  messages: NativeChatMessage[],
  presentation: 'chat' | 'orb' = 'orb',
  settledTurns?: NativeChatSettledTurns
): React.JSX.Element {
  const session: NativeChatLiveSession = {
    messages: messages.map((row, index) => ({ ...row, timestamp: index + 1 })),
    status: 'ready',
    sessionId: 'orb-session',
    agent: 'codex',
    hasMore: false,
    loadingEarlier: false,
    olderHistoryGeneration: 0,
    loadEarlier: vi.fn(),
    readPhase: 'ready'
  }
  return (
    <NativeChatPresentationContext value={presentation}>
      <NativeChatMessageList
        session={session}
        isWorking={false}
        expandSignal={false}
        settledTurns={settledTurns}
      />
    </NativeChatPresentationContext>
  )
}

it.each([AGENT_HUB_ORB_OPENING_PROMPT, "You are Orca's Orb. An older opening instruction."])(
  'hides the Orb seed and replaces it only while the conversation is empty',
  (seed) => {
    const opening = message('seed', 'user', seed)
    const { rerender } = render(conversation([opening]))
    // Markdown splits code spans, so compare the rendered text rather than one node.
    expect(document.body.textContent).not.toContain("You are Orca's Orb")
    expect(screen.getByText('Ready. Type, or press the sphere to talk.')).toBeInTheDocument()
    rerender(conversation([opening, message('question', 'user', 'Summarize my agents')]))
    expect(screen.getByText('Summarize my agents')).toBeInTheDocument()
    expect(screen.queryByText('Ready. Type, or press the sphere to talk.')).toBeNull()
    rerender(conversation([opening], 'chat'))
    expect(document.body.textContent).toContain("You are Orca's Orb")
  }
)

it('collects repeated startup diagnostics behind one disclosure and keeps JSON behind Details', () => {
  const startup = [1, 2].map((index) =>
    notice(`mcp-${index}`, 'notification:mcpServer/startupStatus/updated', 'MCP login needed', {
      name: 'fixture-server',
      status: 'failed',
      error: 'MCP login needed'
    })
  )
  const hook = notice(
    'hook',
    'notification:hook/completed',
    'codex · notification:hook/completed',
    {
      run: { entries: [{ kind: 'error', text: 'hook exited with code 127' }] }
    }
  )
  const approvedText =
    'Automatic approval review approved (risk: low, authorization: high): Allowed status query.'
  const approved = notice('review', 'notification:warning', approvedText, {
    message: 'Allowed status query.'
  })
  const { rerender } = render(
    conversation([
      message('seed', 'user', AGENT_HUB_ORB_OPENING_PROMPT),
      ...startup,
      hook,
      approved,
      message('reply', 'assistant', 'How can I help?')
    ])
  )
  const show = screen.getByRole('button', { name: 'Show' })
  expect(screen.getByText('3 connection warnings')).toBeInTheDocument()
  expect(show).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByText('MCP login needed', { selector: 'p' })).toBeNull()
  expect(screen.queryByText('hook exited with code 127', { selector: 'p' })).toBeNull()
  expect(screen.queryByText(/Automatic approval review/)).toBeNull()
  fireEvent.click(show)
  expect(screen.getAllByText('MCP login needed', { selector: 'p' })).toHaveLength(2)
  expect(screen.getByText('hook exited with code 127', { selector: 'p' })).toBeInTheDocument()
  for (const details of screen.getAllByText('Details')) {
    const disclosure = details.closest('details')
    expect(disclosure).not.toHaveAttribute('open')
    expect(disclosure?.querySelector('pre')).toBeInTheDocument()
  }
  expect(screen.getByText('How can I help?')).toBeInTheDocument()
  rerender(conversation([...startup, approved], 'chat'))
  expect(screen.queryByText('3 connection warnings')).toBeNull()
  expect(screen.getAllByText('MCP login needed', { selector: 'p' })).toHaveLength(2)
  expect(screen.getByText(approvedText, { selector: 'p' })).toBeInTheDocument()
})

it.each([true, false])(
  'keeps runtime and partial-history hook failures visible in Orb',
  (hasUser) => {
    render(
      conversation([
        ...(hasUser ? [message('user', 'user', 'Run the checks')] : []),
        notice('hook', 'notification:hook/completed', 'codex · notification:hook/completed', {
          run: { entries: [{ kind: 'error', text: 'hook exited with code 127' }] }
        }),
        notice(
          'denied',
          'notification:warning',
          'Automatic approval review rejected: Needs a decision.',
          {}
        )
      ])
    )
    expect(screen.queryByText(/connection warnings/)).toBeNull()
    expect(screen.getByText('hook exited with code 127', { selector: 'p' })).toBeInTheDocument()
    expect(
      screen.getByText('Automatic approval review rejected: Needs a decision.')
    ).toBeInTheDocument()
  }
)

it.each([0, 0.5])(
  'omits zero-second turn bars in Orb while keeping ordinary chat timing',
  (seconds) => {
    const messages = [message('user', 'user', 'Hello'), message('reply', 'assistant', 'Hi')]
    const timing = new Map([['user', { startedAt: 1, workedSeconds: seconds }]])
    const { rerender } = render(conversation(messages, 'orb', timing))
    expect(screen.queryByText('Worked for 0s')).toBeNull()
    expect(within(screen.getByLabelText('Conversation')).getByText('Hi')).toBeInTheDocument()
    rerender(conversation(messages, 'chat', timing))
    expect(screen.getByText('Worked for 0s')).toBeInTheDocument()
  }
)
