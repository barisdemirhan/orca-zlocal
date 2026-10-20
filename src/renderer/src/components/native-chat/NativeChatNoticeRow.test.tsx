// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentSessionFailureFact } from '../../../../shared/agent-session-failure'
import type {
  AgentJournalPlainStatusItem,
  AgentJournalStatusItem
} from '../../../../shared/agent-session-journal-types'
import type { NativeChatTextBlock } from '../../../../shared/native-chat-types'
import { MessageRow } from './NativeChatMessageRow'
import { NativeChatNoticeRow } from './NativeChatNoticeRow'
import { NO_OFFER, renderStatus } from './NativeChatNoticeRow.test-fixture'
import { useAppStore } from '@/store'
import { i18n } from '@/i18n/i18n'
import { agentSessionFailureWords } from '../../../../shared/agent-session-failure-words'
import { agentSessionFailureFact } from '../../../../shared/agent-session-failure'
import { NativeChatPresentationContext } from './native-chat-presentation-context'

afterEach(async () => {
  cleanup()
  await i18n.changeLanguage('en')
})

it('keeps a skipped compaction warning truthful instead of showing the success separator', () => {
  renderStatus({
    kind: 'status',
    tone: 'warning',
    text: 'Nothing to compact (session too small)',
    presentation: 'compaction-skipped'
  })
  expect(screen.getByText('Nothing to compact (session too small)')).toBeInTheDocument()
  expect(screen.queryByText('Context compacted')).toBeNull()
})

describe('notice rows', () => {
  it('keeps unmatched host auth wording and its next step', async () => {
    await i18n.changeLanguage('fr')
    const text = 'Use the host-specific sign-in page, then run /compact again.'
    render(
      <NativeChatNoticeRow
        block={{ type: 'text', tone: 'error', text, failure: { kind: 'notSignedIn' } }}
        agentName="Grok"
      />
    )
    expect(screen.getByText(text)).toBeInTheDocument()
  })

  it.each(['providerStartFailed', 'notSignedIn'] as const)(
    'keeps the host /compact retry instruction for %s',
    (kind) => {
      const words = agentSessionFailureWords(
        { kind },
        { agentName: 'Grok', command: 'compact', surface: 'row' }
      )
      renderStatus({ kind: 'status', tone: 'error', ...words }, null, false, false, 'Grok')
      expect(screen.getByText(words.text)).toBeInTheDocument()
      expect(screen.getByText(/Run \/compact again\./)).toBeInTheDocument()
      expect(screen.queryByText(/send your message again/i)).toBeNull()
    }
  )
  it('updates a mounted auth row when the reader changes language', async () => {
    renderStatus(
      {
        kind: 'status',
        tone: 'error',
        ...agentSessionFailureWords({ kind: 'notSignedIn' }, { agentName: 'Grok', surface: 'row' })
      },
      null,
      false,
      false,
      'Grok'
    )
    expect(
      screen.getByText('Sign in to Grok with `grok login` on the computer running this chat.')
    ).toBeInTheDocument()
    await act(() => i18n.changeLanguage('fr'))
    expect(
      screen.getByText(
        'Connectez-vous à Grok avec `grok login` sur l’ordinateur qui exécute ce chat.'
      )
    ).toBeInTheDocument()
  })
  it.each([
    ['fr', 'Grok', 'Connectez-vous à Grok avec `grok login` sur l’ordinateur qui exécute ce chat.'],
    [
      'fr',
      'Pi',
      'Connectez-vous à Pi en exécutant `pi` puis en utilisant `/login` sur l’ordinateur qui exécute ce chat.'
    ],
    ['fr', 'OMP', 'Connectez-vous à OMP.'],
    [
      'ja',
      'Grok',
      'このチャットを実行しているコンピューターで `grok login` を使って Grok にサインインしてください。'
    ],
    [
      'ja',
      'Pi',
      'このチャットを実行しているコンピューターで `pi` を起動し、`/login` を使って Pi にサインインしてください。'
    ],
    ['ja', 'OMP', 'OMP にサインインしてください。']
  ])(
    'rewords known %s auth facts for %s and keeps literal diagnostics',
    async (locale, agentName, guidance) => {
      await i18n.changeLanguage(locale)
      const detail = 'Provider diagnostic: {{agent}} must remain literal.'
      const words = agentSessionFailureWords(
        { kind: 'notSignedIn', detail: { text: detail, audience: 'person' } },
        { agentName, surface: 'row' }
      )
      renderStatus(
        {
          kind: 'status',
          ...words,
          tone: 'error'
        },
        null,
        false,
        false,
        agentName
      )
      expect(
        screen.getByText(`${guidance}${locale === 'ja' ? '' : ' '}${detail}`)
      ).toBeInTheDocument()
      expect(screen.queryByText(words.text)).toBeNull()
    }
  )

  it('rewords managed-account facts without leaking system login instructions', async () => {
    await i18n.changeLanguage('fr')
    renderStatus(
      {
        kind: 'status',
        tone: 'error',
        ...agentSessionFailureWords(
          { kind: 'notSignedIn', account: 'managed' },
          { agentName: 'Claude', surface: 'row' }
        )
      },
      null,
      false,
      false,
      'Claude'
    )
    expect(
      screen.getByText(
        'Ce compte Claude n’est pas connecté. Reconnectez-vous dans les paramètres des Comptes Claude.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByText(/claude auth login/)).toBeNull()
  })

  it.each([{ kind: 'futureFailure' }, { kind: 'notSignedIn', account: 'futureAccount' }])(
    'keeps the host fallback for facts this client cannot fully understand (%j)',
    async (failure) => {
      await i18n.changeLanguage('ja')
      const newerRow = {
        kind: 'status',
        tone: 'error',
        text: 'Future host guidance',
        failure
      }
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: simulates an older client receiving a newer host's unknown failure fact.
      const row = newerRow as unknown as AgentJournalStatusItem
      renderStatus(row, null, false, false, 'Grok')
      expect(screen.getByText('Future host guidance')).toBeInTheDocument()
    }
  )
  it("shows the host's words for a background task the agent would not stop, as an older client does", async () => {
    await i18n.changeLanguage('ja')
    // A client that predates the kind reads no fact, so the row's own text is what it shows.
    renderStatus(
      {
        kind: 'status',
        ...agentSessionFailureWords(
          agentSessionFailureFact('backgroundTaskNotStopped', { backgroundStop: 'task' }),
          { surface: 'row' }
        )
      },
      null,
      false,
      false,
      'Codex'
    )
    expect(screen.getByText("The background task wasn't stopped.")).toBeInTheDocument()
  })
  it('renders compaction as a centered separator', () => {
    renderStatus({ kind: 'status', text: 'Context compacted', presentation: 'compaction' })
    expect(screen.getByRole('separator', { name: 'Context compacted' })).toHaveClass(
      'text-chat-foreground-faint'
    )
    expect(
      screen.getByText('Context compacted').parentElement?.querySelectorAll('.bg-border')
    ).toHaveLength(2)
  })
  it('renders a plan as readable markdown in the card primitive', () => {
    renderStatus({
      kind: 'status',
      text: '# Steps\n\nA **readable** document.',
      presentation: 'plan-document'
    })
    expect(screen.getByText('Plan').closest('[data-slot="card"]')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Steps' })).toBeInTheDocument()
    expect(screen.getByText('readable').tagName).toBe('STRONG')
    expect(screen.getByText('readable').closest('[data-slot="card-content"]')).toHaveClass(
      'text-sm',
      'text-foreground'
    )
  })
  it('shows provider notice text once while retaining its diagnostic disclosure', () => {
    renderStatus({
      kind: 'status',
      text: 'Check the configuration',
      tone: 'warning',
      providerFrame: {
        provider: 'codex',
        kind: 'notification:warning',
        payload: {
          head: '{"message":"Check the configuration"}',
          byteLength: 37,
          digest: 'digest',
          truncated: false
        }
      }
    })
    expect(screen.getAllByText('Check the configuration')).toHaveLength(1)
    const disclosure = screen.getByText('Details').closest('details')
    expect(disclosure?.querySelector('summary')).not.toHaveTextContent('Check the configuration')
    expect(disclosure?.querySelector('pre')).toHaveTextContent('Check the configuration')
  })
  it('retains person-facing usage details without inventing a provider frame', () => {
    renderStatus({
      kind: 'status',
      tone: 'warning',
      ...agentSessionFailureWords(
        agentSessionFailureFact('usageLimitReached', {
          detail: { audience: 'person', text: 'Your allowance resets tomorrow.' }
        }),
        { surface: 'row' }
      )
    })
    const disclosure = screen.getByText('Details').closest('details')
    expect(disclosure?.querySelector('pre')).toHaveTextContent('Your allowance resets tomorrow.')
    expect(screen.queryByText('codex')).not.toBeInTheDocument()
  })

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
    const { container } = renderStatus(body, null, false, false, undefined, NO_OFFER, 'orb')
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
      const { container } = renderStatus(body, null, false, false, undefined, NO_OFFER, 'orb')
      expect(screen.getByText(body.text, { selector: 'p' })).toBeInTheDocument()
      expect(container.querySelector('svg')).toBeInTheDocument()
      expect(screen.queryByText('MCP connection details')).toBeNull()
    }
  )

  it('shows the captured Codex model failure as a readable error with intact diagnostics', () => {
    const frames: { case: string; method: string; params: { error?: { message?: string } } }[] =
      readFileSync(
        join(__dirname, '../../../../main/codex/__fixtures__/codex-app-server-turn-endings.jsonl'),
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
        'orb'
      )
      expect(screen.getByText(text, { selector: 'p' })).toBeInTheDocument()
      expect(container.querySelector('details')).not.toHaveAttribute('open')
      expect(container.querySelector('details pre')).toHaveTextContent(head)
    }
  )
  it('keeps the column layout of command output in monospace', () => {
    const text =
      'Context Usage\n⛁ ⛁ ⛶   gpt-4o · 16.6k/128k tokens (13%)\n      ⛁ Skills: 304 tokens'
    render(
      <MessageRow
        message={{
          id: 'command-output',
          role: 'system',
          blocks: [{ type: 'text', text, presentation: 'command-output' }],
          timestamp: 1,
          source: 'transcript'
        }}
        expandSignal={false}
        onScrollMessageToTop={vi.fn()}
      />
    )
    const output = screen.getByText(/Context Usage/)
    expect(output.tagName).toBe('PRE')
    expect(output).toHaveClass('font-mono')
    expect(output.textContent).toBe(text)
  })
  // The host's text is only for a client that can't word the row itself.
  it.each([
    ['history-repaired', "Part of this chat's history couldn't be loaded."],
    ['history-item-too-large', 'This part of the chat was too large to show.']
  ])('words a %s row itself, as a muted status line', (presentation, words) => {
    renderStatus({ kind: 'status', text: 'Words an older host wrote', presentation })
    expect(screen.getByText(words)).toHaveClass('text-chat-foreground-faint', 'text-sm')
    expect(screen.queryByText('Words an older host wrote')).toBeNull()
  })
})

describe('Codex installation in notice rows', () => {
  it.each([null, '0.135.0'])(
    'shows the plain host failure through the ordinary notice row: %s',
    (installedVersion) => {
      const failure: AgentSessionFailureFact = {
        kind: installedVersion === null ? 'cliMissing' : 'startFailed',
        ...(installedVersion === null
          ? {}
          : {
              refusal: {
                code: 'agent_session_operation_invalid',
                details: {
                  reason: 'attachFailed',
                  codexInstallation: { installedVersion, minimumVersion: '0.136.0' }
                }
              }
            })
      }
      const text = installedVersion
        ? 'Codex 0.135.0 is too old for chats. Update to 0.136.0 or newer.'
        : "Codex wasn't found on the computer running this chat. Install it, or check its Command in Settings → Agents."
      renderStatus(
        {
          kind: 'status',
          tone: 'error',
          ...agentSessionFailureWords(failure, { agentName: 'Codex', surface: 'row' })
        },
        null,
        false,
        false,
        'Codex'
      )
      expect(screen.getByText(text)).toBeInTheDocument()
      expect(screen.queryByRole('button')).toBeNull()
    }
  )
})

it('opens Antigravity accounts from its signed-out notice, and offers no link for other failures', () => {
  const original = useAppStore.getState()
  const openSettingsPage = vi.fn()
  const openSettingsTarget = vi.fn()
  useAppStore.setState({ openSettingsPage, openSettingsTarget })
  try {
    renderStatus(
      {
        kind: 'status',
        tone: 'error',
        ...agentSessionFailureWords(
          { kind: 'notSignedIn' },
          { agentName: 'Antigravity', surface: 'row' }
        )
      },
      null,
      false,
      false,
      'Antigravity'
    )
    const link = screen.getByRole('link', { name: 'Settings → Accounts → Antigravity' })
    expect(link.parentElement).toHaveTextContent(
      "Antigravity isn't signed in. Sign in under Settings → Accounts → Antigravity. Then send your message again."
    )
    expect(screen.queryByRole('button')).toBeNull()
    fireEvent.click(link)
    expect(openSettingsTarget).toHaveBeenCalledExactlyOnceWith({
      pane: 'accounts',
      repoId: null,
      sectionId: 'accounts-antigravity'
    })
    expect(openSettingsPage).toHaveBeenCalledOnce()
    cleanup()
    for (const [agentName, kind] of [
      ['Antigravity', 'startFailed'],
      ['Claude', 'notSignedIn']
    ] as const) {
      renderStatus(
        {
          kind: 'status',
          tone: 'error',
          ...agentSessionFailureWords({ kind }, { agentName, surface: 'row' })
        },
        null,
        false,
        false,
        agentName
      )
      expect(screen.queryByRole('link')).toBeNull()
      cleanup()
    }
  } finally {
    useAppStore.setState({
      openSettingsPage: original.openSettingsPage,
      openSettingsTarget: original.openSettingsTarget
    })
  }
})

it('renders the localized unacknowledged goal pause through the existing Stop notice', async () => {
  await i18n.changeLanguage('ja')
  renderStatus({
    kind: 'status',
    tone: 'warning',
    ...agentSessionFailureWords(agentSessionFailureFact('cancelUnconfirmed'), {
      surface: 'row',
      stopNotice: 'pauseUnconfirmed'
    })
  })
  expect(
    screen.getByText(
      'Codex の実行は停止しましたが、目標の一時停止は確認されていません。続行する前に目標を確認してください。'
    )
  ).toBeInTheDocument()
})
