// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { projectStructuredItemsToNativeChat } from '../../../../../shared/agent-session/view/structured-agent-session-projection'
import type {
  AgentJournalPlainStatusItem,
  AgentJournalStatusItem
} from '../../../../../shared/agent-session/journal/agent-session-journal-types'
import type { NativeChatTextBlock } from '../../../../../shared/native-chat/native-chat-types'

import { TooltipProvider } from '@/components/ui/tooltip'
import { MessageRow } from '@/components/native-chat/messages/rows/NativeChatMessageRow'
import { NativeChatNoticeRow } from '@/components/native-chat/messages/notices/NativeChatNoticeRow'
import { NativeChatPresentationContext } from '../native-chat-presentation-context'
import {
  NativeChatHostSetupContext,
  type NativeChatSignIn
} from '@/components/native-chat/host-access/native-chat-host-setup'

import { i18n } from '@/i18n/i18n'
import { agentSessionFailureWords } from '../../../../../shared/agent-session/failures/agent-session-failure-words'
import { TranslationScopeProvider } from '@/i18n/translation-scope-provider'

import {
  NativeChatOrcaStopContext,
  type NativeChatOrcaStopView
} from '@/components/native-chat/messages/notices/native-chat-orca-stop-context'

afterEach(async () => {
  cleanup()
  await i18n.changeLanguage('en')
})

type ContinueOffer = Pick<NativeChatOrcaStopView, 'offeredTurnItemId' | 'continueNow'> &
  Partial<Pick<NativeChatOrcaStopView, 'usageLimitTurnItemId' | 'continueUsageLimit'>>

function orcaStopView(
  hostLabel: string | null,
  continueAvailable: boolean,
  remoteHost: boolean,
  offer: ContinueOffer
): NativeChatOrcaStopView {
  return {
    hostLabel,
    remoteHost,
    continueAvailable,
    usageLimitTurnItemId: null,
    continueUsageLimit: () => {},
    ...offer
  }
}

const NO_OFFER = { offeredTurnItemId: null, continueNow: () => {} }
const setupWith = (signIn: NativeChatSignIn | null) => ({ signIn, install: null })

function renderStatus(
  body: AgentJournalStatusItem,
  hostLabel: string | null = null,
  continueAvailable = false,
  remoteHost = false,
  agentName?: string,
  offer: ContinueOffer = NO_OFFER,
  signIn: NativeChatSignIn | null = null,
  presentation: 'chat' | 'orb' = 'chat'
) {
  const [message] = projectStructuredItemsToNativeChat([
    {
      itemId: 'notice',
      sequence: 1,
      revision: 1,
      observedAt: 1,
      body,
      turnScope: { kind: 'turn', turnItemId: 'cut-turn' }
    }
  ])
  const view = orcaStopView(hostLabel, continueAvailable, remoteHost, offer)
  const setup = setupWith(signIn)
  return render(
    <TooltipProvider>
      <NativeChatPresentationContext value={presentation}>
        <NativeChatOrcaStopContext.Provider value={view}>
          <NativeChatHostSetupContext.Provider value={setup}>
            <MessageRow
              message={message!}
              agentName={agentName}
              expandSignal={false}
              onScrollMessageToTop={vi.fn()}
            />
          </NativeChatHostSetupContext.Provider>
        </NativeChatOrcaStopContext.Provider>
      </NativeChatPresentationContext>
    </TooltipProvider>,
    { wrapper: TranslationScopeProvider }
  )
}

describe('usage-limit reset clock changes', () => {
  const start = new Date(2026, 9, 18, 12).getTime()
  const hour = 60 * 60 * 1000
  const continueUsageLimit = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers({ now: start, toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    continueUsageLimit.mockClear()
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  function notice(resetsAt?: number, count = 1) {
    const view = orcaStopView(null, false, false, {
      ...NO_OFFER,
      usageLimitTurnItemId: 'cut-turn',
      continueUsageLimit
    })
    return (
      <TooltipProvider>
        <NativeChatOrcaStopContext.Provider value={view}>
          {Array.from({ length: count }, (_, index) => (
            <NativeChatNoticeRow
              key={`chat-${index}`}
              agentName="Claude"
              block={{
                type: 'text',
                tone: 'warning',
                text: 'Claude hit its usage limit.',
                usageLimitTurnItemId: 'cut-turn',
                failure: { kind: 'usageLimitReached', usageLimit: { window: 'session', resetsAt } }
              }}
            />
          ))}
        </NativeChatOrcaStopContext.Provider>
      </TooltipProvider>
    )
  }

  it('keeps unknown resets hidden and uses replacement resets immediately, including on remount', () => {
    const row = render(notice())
    expect(screen.queryByRole('button', { name: 'Continue Now' })).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
    row.rerender(notice(start + 6 * hour))
    vi.setSystemTime(start + 3 * hour)
    row.rerender(notice(start + 4 * hour))
    act(() => vi.advanceTimersByTime(hour))
    expect(screen.getByRole('button', { name: 'Continue Now' })).toBeInTheDocument()
    row.rerender(notice(start + 6 * hour))
    expect(screen.queryByRole('button', { name: 'Continue Now' })).toBeNull()
    row.rerender(notice(start + 2 * hour))
    expect(screen.getByRole('button', { name: 'Continue Now' })).toBeInTheDocument()
    row.rerender(notice())
    expect(screen.queryByRole('button', { name: 'Continue Now' })).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
    row.unmount()
    render(notice(start + 2 * hour))
    expect(screen.getByRole('button', { name: 'Continue Now' })).toBeInTheDocument()
    expect(continueUsageLimit).not.toHaveBeenCalled()
  })

  it.each(['rerender', 'focus', 'visibilitychange'] as const)(
    'rechecks forward and backward clock corrections on %s',
    (signal) => {
      const row = render(notice(start + hour))
      const refresh = () => {
        if (signal === 'rerender') {
          row.rerender(notice(start + hour))
        } else if (signal === 'focus') {
          fireEvent(window, new Event('focus'))
        } else {
          fireEvent(document, new Event('visibilitychange'))
        }
      }
      vi.setSystemTime(start + 2 * hour)
      refresh()
      expect(screen.getByRole('button', { name: 'Continue Now' })).toBeInTheDocument()
      vi.setSystemTime(start)
      refresh()
      expect(screen.queryByRole('button', { name: 'Continue Now' })).toBeNull()
      act(() => vi.advanceTimersByTime(hour))
      expect(screen.getByRole('button', { name: 'Continue Now' })).toBeInTheDocument()
      expect(continueUsageLimit).not.toHaveBeenCalled()
    }
  )
})

describe('notice rows', () => {
  function mcpStartupFailure(
    name = 'sentry',
    text = 'The sentry MCP server is not logged in. Run `codex mcp login sentry`.'
  ): AgentJournalPlainStatusItem {
    const head = JSON.stringify({ threadId: 'thread-fixture', name, status: 'failed', error: text })
    return {
      kind: 'status',
      text,
      tone: 'error',
      providerFrame: {
        provider: 'codex',
        kind: 'notification:mcpServer/startupStatus/updated',
        payload: { head, byteLength: head.length, digest: 'digest', truncated: false }
      }
    }
  }

  it.each([
    ['sentry', 'The sentry MCP server is not logged in. Run `codex mcp login sentry`.'],
    ['postman', 'The postman MCP server requires OAuth reauthentication.'],
    ['raindrop', 'MCP client for `raindrop` failed to start: Transport channel closed.']
  ])('keeps the first %s startup error inside closed diagnostics', (name, text) => {
    const body = mcpStartupFailure(name, text)
    const { container } = renderStatus(body, null, false, false, undefined, NO_OFFER, null, 'orb')
    const disclosure = screen.getByText('MCP connection details').closest('details')

    expect(disclosure).not.toHaveAttribute('open')
    expect(disclosure).toHaveClass('text-chat-foreground-faint')
    expect(disclosure?.querySelector('summary')).not.toHaveTextContent(text)
    expect(disclosure?.querySelector('pre')).toHaveTextContent(body.providerFrame!.payload.head)
    expect(container.querySelector('p')).toBeNull()
    expect(container.querySelector('svg')).toBeNull()
  })

  it.each([
    [
      'turn error',
      {
        ...mcpStartupFailure(),
        providerFrame: { ...mcpStartupFailure().providerFrame!, kind: 'notification:error' }
      }
    ],
    [
      'typed failure',
      {
        ...mcpStartupFailure(),
        ...agentSessionFailureWords(
          {
            kind: 'providerStartFailed',
            detail: { text: 'The MCP server is unavailable.', audience: 'person' }
          },
          { agentName: 'Codex', surface: 'row' }
        )
      }
    ],
    ['presentation', { ...mcpStartupFailure(), presentation: 'future-error' }],
    [
      'other provider',
      {
        ...mcpStartupFailure(),
        providerFrame: { ...mcpStartupFailure().providerFrame!, provider: 'future' }
      }
    ]
  ] satisfies [string, AgentJournalStatusItem][])(
    'keeps a %s visible even when it mentions an MCP server',
    (_name, body) => {
      const { container } = renderStatus(body, null, false, false, undefined, NO_OFFER, null, 'orb')
      expect(screen.getByText(body.text, { selector: 'p' })).toBeInTheDocument()
      expect(container.querySelector('svg')).toBeInTheDocument()
      expect(screen.queryByText('MCP connection details')).toBeNull()
    }
  )

  it('shows the captured Codex model failure as a readable error with intact diagnostics', () => {
    const frames: { case: string; method: string; params: { error?: { message?: string } } }[] =
      readFileSync(
        join(
          __dirname,
          '../../../../../main/codex/__fixtures__/codex-app-server-turn-endings.jsonl'
        ),
        'utf8'
      )
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line))
    const frame = frames.find(
      (entry) => entry.case === '0.141.0-bad-model' && entry.method === 'error'
    )
    const text = frame?.params.error?.message
    if (!frame || !text) {
      throw new Error('Expected the captured Codex model error')
    }
    const head = JSON.stringify(frame.params)
    const { container } = renderStatus(
      {
        kind: 'status',
        tone: 'error',
        text,
        providerFrame: {
          provider: 'codex',
          kind: `notification:${frame.method}`,
          payload: { head, byteLength: head.length, digest: 'digest', truncated: false }
        }
      },
      null,
      false,
      false,
      undefined,
      NO_OFFER,
      null,
      'orb'
    )
    expect(
      screen.getByText(
        "The 'gpt-qa-nonexistent' model is not supported when using Codex with a ChatGPT account.",
        { selector: 'p' }
      )
    ).toBeInTheDocument()
    expect(container.querySelector('svg')).toBeInTheDocument()
    const disclosure = screen.getByText('Details').closest('details')
    expect(disclosure).not.toHaveAttribute('open')
    expect(disclosure?.querySelector('pre')).toHaveTextContent(head)
  })

  it.each([
    ['malformed envelope', '{"type":"error",', {}],
    [
      'unknown envelope',
      '{"type":"error","status":400,"error":{"type":"future_error","message":"Provider detail"}}',
      {}
    ],
    [
      'typed failure',
      '{"type":"error","status":400,"error":{"type":"invalid_request_error","message":"Provider detail"}}',
      { failure: { kind: 'providerStartFailed' } }
    ]
  ] satisfies [string, string, Partial<NativeChatTextBlock>][])(
    'preserves the original Codex error text for a %s',
    (_name, text, extra) => {
      const head = JSON.stringify({ error: { message: text } })
      render(
        <NativeChatPresentationContext value="orb">
          <NativeChatNoticeRow
            block={{
              type: 'text',
              tone: 'error',
              text,
              providerFrame: {
                provider: 'codex',
                kind: 'notification:error',
                payload: { head, byteLength: head.length, digest: 'digest', truncated: false }
              },
              ...extra
            }}
          />
        </NativeChatPresentationContext>
      )
      expect(screen.getByText(text, { selector: 'p' })).toBeInTheDocument()
    }
  )

  const approvedReview =
    'Automatic approval review approved (risk: low, authorization: medium): Read-only status query within the requested task.'

  function reviewWarning(extra: Partial<NativeChatTextBlock> = {}): NativeChatTextBlock {
    const payload = JSON.stringify({ threadId: 'thread-fixture', message: approvedReview })
    return {
      type: 'text',
      text: approvedReview,
      tone: 'warning',
      providerFrame: {
        provider: 'codex',
        kind: 'notification:warning',
        payload: {
          head: payload,
          byteLength: payload.length,
          digest: 'digest',
          truncated: false
        }
      },
      ...extra
    }
  }

  it('omits a successful automatic review from Orb', () => {
    const block = reviewWarning()
    const { container } = render(
      <NativeChatPresentationContext value="orb">
        <NativeChatNoticeRow block={block} />
      </NativeChatPresentationContext>
    )
    expect(screen.queryByText('Automatic approval review approved')).toBeNull()
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByText(approvedReview, { selector: 'p' })).toBeNull()
  })

  it('omits a successful automatic review reported as a guardian warning', () => {
    const block = reviewWarning({
      providerFrame: { ...reviewWarning().providerFrame!, kind: 'notification:guardianWarning' }
    })
    const { container } = render(
      <NativeChatPresentationContext value="orb">
        <NativeChatNoticeRow block={block} />
      </NativeChatPresentationContext>
    )
    expect(container).toBeEmptyDOMElement()
  })

  it.each([
    ['rejected review', { text: approvedReview.replace('approved', 'rejected') }],
    ['review question', { text: 'Automatic approval review requires a decision: Allow access?' }],
    ['unrecognized warning', { text: 'Sandbox access needs attention.' }],
    ['unknown review format', { text: approvedReview.replace('risk: low', 'risk: unknown') }],
    ['error row', { tone: 'error' }],
    ['failure fact', { failure: { kind: 'providerStartFailed' } }],
    ['presentation row', { presentation: 'future-warning' }],
    [
      'answered request',
      { providerFrame: { ...reviewWarning().providerFrame!, kind: 'request:approval' } }
    ]
  ] satisfies [string, Partial<NativeChatTextBlock>][])(
    'keeps the full notice for a %s',
    (_name, extra) => {
      const block = reviewWarning(extra)
      const { container } = render(
        <NativeChatPresentationContext value="orb">
          <NativeChatNoticeRow block={block} />
        </NativeChatPresentationContext>
      )
      expect(screen.getByText(block.text, { selector: 'p' })).toBeInTheDocument()
      expect(container.querySelector('svg')).toBeInTheDocument()
    }
  )

  const storedHookPayload = JSON.stringify({
    run: {
      id: 'stop:17:/fixtures/hooks.json',
      status: 'failed',
      entries: [{ kind: 'error', text: 'hook exited with code 127' }]
    }
  })

  const modelErrorEnvelope =
    '{"type":"error","status":400,"error":{"type":"invalid_request_error","message":"The selected model is unsupported."}}'

  it.each([
    [
      'automatic review',
      {
        kind: 'status',
        text: approvedReview,
        tone: 'warning',
        providerFrame: reviewWarning().providerFrame
      }
    ],
    ['MCP startup', mcpStartupFailure()],
    [
      'hook error',
      {
        kind: 'status',
        text: 'codex · notification:hook/completed',
        tone: 'error',
        providerFrame: {
          provider: 'codex',
          kind: 'notification:hook/completed',
          payload: {
            head: storedHookPayload,
            byteLength: storedHookPayload.length,
            digest: 'digest',
            truncated: false
          }
        }
      }
    ],
    [
      'model error',
      {
        kind: 'status',
        text: modelErrorEnvelope,
        tone: 'error',
        providerFrame: {
          provider: 'codex',
          kind: 'notification:error',
          payload: {
            head: modelErrorEnvelope,
            byteLength: modelErrorEnvelope.length,
            digest: 'digest',
            truncated: false
          }
        }
      }
    ]
  ] satisfies [string, AgentJournalStatusItem][])(
    'keeps the original normal Chat View presentation for %s',
    (_name, body) => {
      const { container } = renderStatus(body)
      expect(screen.getByText(body.text, { selector: 'p' })).toBeInTheDocument()
      expect(container.querySelector('svg')).toBeInTheDocument()
      expect(screen.getByText('Details').closest('details')).not.toHaveAttribute('open')
    }
  )

  it.each([
    [
      'complete older hook frame',
      'notification:hook/completed',
      storedHookPayload,
      false,
      'hook exited with code 127'
    ],
    [
      'malformed payload',
      'notification:hook/completed',
      '{',
      false,
      'codex · notification:hook/completed'
    ],
    [
      'truncated payload',
      'notification:hook/completed',
      storedHookPayload,
      true,
      'codex · notification:hook/completed'
    ],
    [
      'another frame kind',
      'notification:future/event',
      storedHookPayload,
      false,
      'codex · notification:future/event'
    ]
  ] as const)(
    'reads a %s without guessing from other diagnostics',
    (_name, kind, head, truncated, text) => {
      const { container } = renderStatus(
        {
          kind: 'status',
          text: `codex · ${kind}`,
          tone: 'error',
          providerFrame: {
            provider: 'codex',
            kind,
            payload: { head, byteLength: head.length, digest: 'digest', truncated }
          }
        },
        null,
        false,
        false,
        undefined,
        NO_OFFER,
        null,
        'orb'
      )
      expect(screen.getByText(text, { selector: 'p' })).toBeInTheDocument()
      expect(container.querySelector('details')).not.toHaveAttribute('open')
      expect(container.querySelector('details pre')).toHaveTextContent(head)
    }
  )
})

// Protocol-shaped synthetic notices; no exact recorded review/denial capture is available.
it.each([
  [
    'codex',
    'notification:guardianWarning',
    'warning',
    'Codex reported a safety review warning. View details.',
    'Codex a signalé un avertissement de sécurité. Voir les détails.'
  ],
  [
    'claude',
    'message:system:permission_denied',
    'error',
    'Claude denied permission. View details.',
    'Claude a refusé la permission. Voir les détails.'
  ]
] as const)(
  'compacts the declared %s notice while retaining every available diagnostic',
  async (provider, kind, tone, heading, french) => {
    const text = `${'安全 '.repeat(1500)}EXPLANATION_SENTINEL`
    const head = `{"partial":"${'é'.repeat(4500)}PAYLOAD_SENTINEL`
    renderStatus({
      kind: 'status',
      tone,
      text,
      providerFrame: {
        provider,
        kind,
        payload: { head, byteLength: 99999, digest: 'synthetic', truncated: true }
      }
    })
    const summary = screen.getByText(heading).closest('summary')!
    const disclosure = summary.closest('details')!
    expect(disclosure.open).toBe(false)
    expect(summary).not.toHaveTextContent(/SENTINEL|99999/)
    expect(disclosure.parentElement).not.toHaveClass('text-destructive', 'text-chat-warning')
    fireEvent.click(summary)
    expect(disclosure.open).toBe(true)
    const detail = disclosure.querySelector('pre')!
    expect(detail.textContent).toContain(text)
    expect(detail.textContent).toContain(head)
    expect(detail).toHaveTextContent('Provider response truncated (original size: 99999 bytes).')
    expect(detail).toHaveClass(tone === 'error' ? 'text-destructive' : 'text-chat-warning')
    expect(screen.queryByText('Show full output')).toBeNull()
    await act(() => i18n.changeLanguage('fr'))
    expect(summary).toHaveTextContent(french)
    expect(detail).toHaveTextContent(
      'Réponse du fournisseur tronquée (taille d’origine : 99999 octets).'
    )
    expect(disclosure.open).toBe(true)
  }
)
