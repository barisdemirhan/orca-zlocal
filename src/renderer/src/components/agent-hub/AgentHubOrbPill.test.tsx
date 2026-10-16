// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRef } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { EMPTY_STRUCTURED_AGENT_SESSION } from '../../../../shared/structured-agent-session-reducer'
import { AgentHubOrbPill, AgentHubOrbPillContent } from './AgentHubOrbPill'
import { orbApproval, orbAsk } from './agent-hub-orb-test-fixtures'
import { applyAgentHubDelivery, clearAgentHubRequestHost } from './agent-hub-requests-store'
import { registerAgentHubRequestResponder } from './agent-hub-request-answer'
import { isAdmissibleAgentJournalItemBody } from '../../../../shared/agent-session-journal-schemas'

const mocks = vi.hoisted(() => ({ mutate: vi.fn(), cancel: vi.fn() }))
vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  return {
    useAppStore: create(() => ({
      keybindings: {},
      partialTranscript: '',
      dictationState: 'listening',
      settings: { voice: { dictationMode: 'toggle' } }
    }))
  }
})
vi.mock('../native-chat/use-structured-agent-session-mutate', () => ({
  useStructuredAgentSessionMutate: () => ({ mutate: mocks.mutate })
}))
vi.mock('@/runtime/structured-agent-session-client', () => ({
  supportsStructuredAgentSessionQuestionAnswers: async () => true,
  supportsStructuredAgentSessionPromptCancel: async () => true
}))
vi.mock('./agent-hub-dictation-cancel', () => ({
  cancelDictation: mocks.cancel,
  canCancelDictation: () => true
}))

const props = {
  sessionId: 'orb-session',
  readState: { ...EMPTY_STRUCTURED_AGENT_SESSION, fence: 1 }
}
beforeEach(() => {
  vi.clearAllMocks()
  clearAgentHubRequestHost('local')
  mocks.mutate.mockResolvedValue(null)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  clearAgentHubRequestHost('local')
})
const show = (state: Parameters<typeof AgentHubOrbPillContent>[0]['state'], onOpen = vi.fn()) =>
  render(
    <TooltipProvider>
      <AgentHubOrbPillContent {...props} state={state} onOpen={onOpen} />
    </TooltipProvider>
  )

describe('Orb pill', () => {
  it('uses the one-time permission on Enter even when Grok offers session-wide edits first', async () => {
    const item = orbApproval()
    if (item.body.kind !== 'approval') {
      throw new Error('Expected approval fixture')
    }
    // Grok's recorded option order: src/main/acp/fixtures/s2-permission.jsonl.
    const body = {
      ...item.body,
      options: [
        {
          id: 'allow-edits-session',
          label: 'Yes, allow all edits during this session',
          permissionKind: 'allow_always'
        },
        { id: 'allow-once', label: 'Yes', permissionKind: 'allow_once' },
        {
          id: 'reject-once',
          label: 'No, and tell Grok what to do differently',
          permissionKind: 'reject_once'
        }
      ]
    }
    vi.useFakeTimers()
    vi.setSystemTime(100_000)
    show({ kind: 'needsYou', request: { kind: 'prompt', item: { ...orbApproval(), body } } })
    act(() => vi.advanceTimersByTime(400))
    await act(async () => fireEvent.keyDown(document.body, { key: 'Enter' }))
    expect(mocks.mutate).toHaveBeenCalledWith(
      'agentSession.respondToApproval',
      'agentSession.respondTo:approval',
      { itemId: 'approval', expectedRevision: 2, optionId: 'allow-once' }
    )
  })

  it.each([undefined, 'future_allow', 'allow_always'])(
    'opens approvals with scope %s on Enter without granting anything',
    async (permissionKind) => {
      vi.useFakeTimers()
      vi.setSystemTime(100_000)
      const open = vi.fn()
      const item = orbApproval()
      if (item.body.kind !== 'approval') {
        throw new Error('Expected approval fixture')
      }
      const body = {
        ...item.body,
        options: item.body.options.map(({ id, label }) => ({
          id,
          label,
          ...(permissionKind === undefined ? {} : { permissionKind })
        }))
      }
      show({ kind: 'needsYou', request: { kind: 'prompt', item: { ...item, body } } }, open)
      act(() => vi.advanceTimersByTime(400))
      await act(async () => fireEvent.keyDown(document.body, { key: 'Enter' }))
      expect(mocks.mutate).not.toHaveBeenCalled()
      expect(open).toHaveBeenCalledOnce()
    }
  )

  it.each(['off', 'idle'] as const)('does not occupy the slot while %s', (kind) => {
    show({ kind })
    expect(document.querySelector('[data-agent-hub-orb-pill]')).toBeNull()
  })
  it('shows working with its command and opens the conversation', () => {
    const open = vi.fn()
    show({ kind: 'working', command: 'pnpm test' }, open)
    fireEvent.click(screen.getByRole('button', { name: 'Working · pnpm test' }))
    expect(open).toHaveBeenCalledOnce()
  })
  it('shows the completed first line with an Open action', () => {
    const open = vi.fn()
    show({ kind: 'done', summary: 'All tests passed', expiresAt: 106_000 }, open)
    expect(screen.getByText('All tests passed')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    expect(open).toHaveBeenCalledOnce()
  })
  it('uses the compact dictation controls, Orb binding and elapsed counter, with Esc cancellation', () => {
    vi.useFakeTimers()
    vi.setSystemTime(100_000)
    show({ kind: 'listening' })
    expect(document.querySelector('[data-agent-hub-dictate=listening]')).toBeTruthy()
    expect(screen.getByText('Not set')).toBeTruthy()
    expect(screen.getByText('to send')).toBeTruthy()
    const field = document.createElement('textarea')
    document.body.append(field)
    fireEvent.keyDown(field, { key: 'Escape' })
    expect(mocks.cancel).toHaveBeenCalledOnce()
    field.remove()
    act(() => vi.advanceTimersByTime(2100))
    expect(screen.getByRole('timer').textContent).toBe('0:02')
  })
  it('answers an Orb ask through the shared responder and refuses a second answer', async () => {
    const request = orbAsk()
    applyAgentHubDelivery('local', request)
    const send = vi.fn(async () => {})
    const stop = registerAgentHubRequestResponder(send)
    show({ kind: 'needsYou', request: { kind: 'request', item: { host: 'local', request } } })
    expect(screen.getByText('Which approach?')).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Second/ }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /First/ }))
    })
    expect(send).toHaveBeenCalledOnce()
    expect(send).toHaveBeenCalledWith('local', request.requestId, {
      kind: 'ask',
      answer: 'Second',
      index: 2
    })
    stop()
  })
  it('guards approval keys when a field or terminal owns them and while the pill is new', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(100_000)
    show({ kind: 'needsYou', request: { kind: 'prompt', item: orbApproval() } })
    fireEvent.keyDown(document.body, { key: 'Enter' })
    expect(mocks.mutate).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(400))
    const field = document.createElement('textarea')
    field.className = 'xterm-helper-textarea'
    document.body.append(field)
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(mocks.mutate).not.toHaveBeenCalled()
    await act(async () => {
      fireEvent.keyDown(document.body, { key: 'Escape' })
    })
    expect(mocks.mutate).toHaveBeenCalledWith(
      'agentSession.respondToApproval',
      'agentSession.respondTo:approval',
      { itemId: 'approval', expectedRevision: 2, optionId: 'deny' }
    )
    field.remove()
  })
  it('uses the provider option id and fences a double click while the answer is pending', async () => {
    const pending = new Promise<null>(() => {})
    mocks.mutate.mockReturnValue(pending)
    show({ kind: 'needsYou', request: { kind: 'prompt', item: orbApproval() } })
    const allow = screen.getByRole('button', { name: /^1.*Allow/ })
    await act(async () => {
      fireEvent.click(allow)
      fireEvent.click(allow)
    })
    expect(mocks.mutate).toHaveBeenCalledOnce()
    expect(mocks.mutate).toHaveBeenCalledWith(
      'agentSession.respondToApproval',
      'agentSession.respondTo:approval',
      { itemId: 'approval', expectedRevision: 2, optionId: 'allow' }
    )
  })
  it('opens a newer approval in the chat without offering to approve its unknown subject', () => {
    const approval = orbApproval()
    if (approval.body.kind !== 'approval') {
      throw new Error('Expected approval fixture')
    }
    const body: unknown = { ...approval.body, subject: { kind: 'future' } }
    if (!isAdmissibleAgentJournalItemBody(body) || body.kind !== 'approval') {
      throw new Error('Expected admissible newer approval')
    }
    show({
      kind: 'needsYou',
      request: {
        kind: 'prompt',
        item: { ...approval, body }
      }
    })
    expect(screen.queryByRole('button', { name: /Allow$/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Open' })).toBeTruthy()
  })
  it('holds an acknowledged answer until the journal settles, but lets a failed answer retry', async () => {
    mocks.mutate.mockResolvedValueOnce(null).mockResolvedValueOnce({
      itemId: 'approval',
      revision: 3,
      resolution: {
        state: 'resolved',
        selectedOptionId: 'allow',
        resolvedBy: 'desktop',
        resolvedAt: 100_000
      }
    })
    show({ kind: 'needsYou', request: { kind: 'prompt', item: orbApproval() } })
    const allow = screen.getByRole('button', { name: /^1.*Allow/ })
    await act(async () => {
      fireEvent.click(allow)
    })
    expect(allow.hasAttribute('disabled')).toBe(false)
    await act(async () => {
      fireEvent.click(allow)
    })
    await act(async () => {
      fireEvent.click(allow)
    })
    expect(mocks.mutate).toHaveBeenCalledTimes(2)
    expect(allow.hasAttribute('disabled')).toBe(true)
  })
  it('cancels an approval whose provider uses opaque option ids through the native prompt path', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(100_000)
    const approval = orbApproval()
    show({
      kind: 'needsYou',
      request: {
        kind: 'prompt',
        item: {
          ...approval,
          body: {
            ...approval.body,
            options: [
              { id: 'choice-a', label: 'Allow' },
              { id: 'choice-b', label: 'Deny' }
            ]
          }
        }
      }
    })
    act(() => vi.advanceTimersByTime(400))
    await act(async () => {
      fireEvent.keyDown(document.body, { key: 'Escape' })
    })
    expect(mocks.mutate).toHaveBeenCalledWith('agentSession.cancel', 'agentSession.cancel', {
      prompt: { itemId: 'approval', expectedRevision: 2 }
    })
  })
  it('replaces its fallback position when the dock anchor attaches after the first render', () => {
    function LateAnchor(): React.JSX.Element {
      const anchorRef = useRef<HTMLDivElement>(null)
      return (
        <>
          <AgentHubOrbPill
            {...props}
            state={{ kind: 'working' }}
            anchorRef={anchorRef}
            side="top"
            onOpen={vi.fn()}
          />
          <div ref={anchorRef} />
        </>
      )
    }
    render(<LateAnchor />)
    fireEvent(window, new Event('resize'))
    const pill = document.querySelector('[data-agent-hub-orb-pill]')?.parentElement
    expect(pill?.style.transform).toBe('')
    expect(pill?.style.bottom).toBe('')
  })
  it('keeps the whole pill within a narrow viewport beside a right-hand anchor', () => {
    const width = window.innerWidth
    const height = window.innerHeight
    const anchor = document.createElement('div')
    document.body.append(anchor)
    vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue(new DOMRect(300, 200, 20, 20))
    try {
      window.innerWidth = 320
      window.innerHeight = 240
      render(
        <AgentHubOrbPill
          {...props}
          state={{ kind: 'working', command: 'pnpm test' }}
          anchorRef={{ current: anchor }}
          side="right"
          onOpen={vi.fn()}
        />
      )
      const pill = document.querySelector('[data-agent-hub-orb-pill]')?.parentElement
      if (!pill) {
        throw new Error('Expected Orb pill')
      }
      vi.spyOn(pill, 'offsetWidth', 'get').mockReturnValue(240)
      vi.spyOn(pill, 'offsetHeight', 'get').mockReturnValue(40)
      fireEvent(window, new Event('resize'))
      expect(Number.parseFloat(pill.style.left)).toBeGreaterThanOrEqual(8)
      expect(Number.parseFloat(pill.style.left) + pill.offsetWidth).toBeLessThanOrEqual(312)
      expect(Number.parseFloat(pill.style.top) + pill.offsetHeight).toBeLessThanOrEqual(232)
    } finally {
      window.innerWidth = width
      window.innerHeight = height
      anchor.remove()
    }
  })
  it.each(['top', 'bottom', 'left', 'right'] as const)(
    'anchors its pill on the %s side and follows a changed edge',
    (side) => {
      const anchor = document.createElement('div')
      document.body.append(anchor)
      vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue(new DOMRect(400, 300, 160, 28))
      const { unmount } = render(
        <AgentHubOrbPill
          {...props}
          state={{ kind: 'working' }}
          anchorRef={{ current: anchor }}
          side={side}
          onOpen={vi.fn()}
        />
      )
      const pill = document.querySelector('[data-agent-hub-orb-pill]')?.parentElement
      expect(pill?.style.top).toBe(side === 'top' ? '290px' : side === 'bottom' ? '338px' : '314px')
      expect(pill?.style.left).toBe(
        side === 'left' ? '390px' : side === 'right' ? '570px' : '480px'
      )
      unmount()
      anchor.remove()
    }
  )
})
