// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentJournalStatusItem } from '../../../../shared/agent-session/journal/agent-session-journal-types'
import { agentSessionFailureWords } from '../../../../shared/agent-session/failures/agent-session-failure-words'
import { agentSessionFailureFact } from '../../../../shared/agent-session/failures/agent-session-failure'
import { isAdmissibleAgentJournalItemBody } from '../../../../shared/agent-session/journal/agent-session-journal-schemas'
import { NO_OFFER, renderStatus } from './NativeChatNoticeRow.test-fixture'

afterEach(cleanup)

const LEGACY_TEXT =
  'Codex stopped while this response was in progress. You can continue in this conversation.'

function orcaStopRow(cause: string): AgentJournalStatusItem {
  return {
    kind: 'status',
    text: LEGACY_TEXT,
    tone: 'error',
    presentation: 'orca-stop',
    orcaStop: { cause }
  }
}

describe('the row an Orca stop leaves', () => {
  it.each([
    ['update', 'Orca on studio-mac restarted for an update while this response was in progress.'],
    ['quit', 'Orca on studio-mac was closed while this response was in progress.'],
    ['crash', 'Orca on studio-mac stopped unexpectedly while this response was in progress.']
  ])('names a %s and the machine, muted', (cause, sentence) => {
    renderStatus(orcaStopRow(cause), 'studio-mac')
    const row = screen.getByText(`${sentence} You can continue in this conversation.`)
    expect(row.parentElement?.parentElement).toHaveClass('text-chat-foreground-faint')
    expect(screen.queryByText(LEGACY_TEXT)).toBeNull()
  })

  it('carries Continue on the cut it is offered for, and only there', () => {
    const continueNow = vi.fn()
    renderStatus(orcaStopRow('quit'), 'studio-mac', true, false, undefined, {
      offeredTurnItemId: 'cut-turn',
      continueNow
    })
    const sentence = screen.getByText(
      'Orca on studio-mac was closed while this response was in progress.'
    )
    const button = screen.getByRole('button', { name: 'Continue' })
    // Beside the words that say why, in the same card.
    expect(sentence.parentElement).toContainElement(button)
    fireEvent.click(button)
    expect(continueNow).toHaveBeenCalledOnce()
    cleanup()

    renderStatus(orcaStopRow('quit'), 'studio-mac', true, false, undefined, {
      offeredTurnItemId: 'another-turn',
      continueNow
    })
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull()
  })

  it("says a remote host's Orca stopped, not that it was closed", () => {
    renderStatus(orcaStopRow('quit'), 'QA SSH', true, true)
    expect(
      screen.getByText('Orca on QA SSH stopped while this response was in progress.').parentElement
        ?.parentElement
    ).toHaveClass('text-chat-foreground-faint')
    expect(screen.queryByText(/was closed/)).toBeNull()
  })

  // A client that re-words unnamed host rows keeps this row's presentation and cause, neutral.
  it('stays neutral, naming the cause, as a reader that re-presented it neutral hands it on', () => {
    // Its words and tone replaced, and the failure fact the old words came from dropped with them.
    const represented: AgentJournalStatusItem = {
      kind: 'status',
      text: 'This response was interrupted. You can continue in this conversation.',
      tone: 'notice',
      presentation: 'orca-stop',
      orcaStop: { cause: 'crash' }
    }
    renderStatus(represented, 'studio-mac', true)
    expect(
      screen.getByText(
        'Orca on studio-mac stopped unexpectedly while this response was in progress.'
      ).parentElement?.parentElement
    ).toHaveClass('text-chat-foreground-faint')
    cleanup()
    renderStatus(represented, null, true)
    expect(
      screen.getByText('This response was interrupted. You can continue in this conversation.')
        .parentElement?.parentElement
    ).toHaveClass('text-chat-foreground-faint')
  })

  it('keeps the host words for a cause this build does not know', () => {
    renderStatus(orcaStopRow('power-loss'), 'studio-mac')
    expect(screen.getByText(LEGACY_TEXT)).toBeInTheDocument()
  })

  it('keeps the host words when the chat has no machine to name, muted all the same', () => {
    renderStatus(orcaStopRow('update'), null)
    expect(screen.getByText(LEGACY_TEXT).parentElement?.parentElement).toHaveClass(
      'text-chat-foreground-faint'
    )
  })

  it('calls a paired server with no name the remote server, so its words match the button', () => {
    renderStatus(orcaStopRow('update'), null, true, true)
    expect(
      screen.getByText(
        'Orca on the remote server restarted for an update while this response was in progress.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByText(LEGACY_TEXT)).toBeNull()
  })

  it('keeps the host words for a stop Orca did not cause', () => {
    const { orcaStop: _orcaStop, presentation: _presentation, ...agentExit } = orcaStopRow('update')
    renderStatus(agentExit, 'studio-mac')
    expect(screen.getByText(LEGACY_TEXT).parentElement?.parentElement).toHaveClass(
      'text-destructive'
    )
  })
})

describe('the row a usage limit leaves', () => {
  const resetsAt = new Date(2026, 9, 18, 15, 0).getTime()
  const row = {
    kind: 'status',
    tone: 'warning',
    text: 'Claude hit its session limit. Send a message once it resets to continue.',
    failure: { kind: 'usageLimitReached', usageLimit: { window: 'session', resetsAt } }
  } as const

  it.each([
    ['future', resetsAt],
    ['past', new Date(2026, 9, 18, 10, 0).getTime()],
    ['unknown', undefined]
  ] as const)('shows a %s reset without a continuation action or instruction', (_state, reset) => {
    vi.useFakeTimers({ now: new Date(2026, 9, 18, 12, 30), toFake: ['Date'] })
    try {
      renderStatus(
        {
          kind: 'status',
          tone: 'warning',
          ...agentSessionFailureWords(
            agentSessionFailureFact('usageLimitReached', {
              usageLimit: { window: 'session', ...(reset === undefined ? {} : { resetsAt: reset }) }
            }),
            { agentName: 'Claude', surface: 'row' }
          )
        },
        null,
        false,
        false,
        'Claude',
        { ...NO_OFFER, usageLimitTurnItemId: 'cut-turn', continueUsageLimit: vi.fn() }
      )
      const clock =
        reset === undefined
          ? null
          : new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(reset)
      expect(
        screen.getByText(
          clock === null
            ? 'Claude hit its session limit.'
            : `Claude hit its session limit. It resets at ${clock}.`
        )
      ).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull()
      expect(screen.queryByText(/Send a message once it resets/)).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it.each(['typed', 'text-only', 'unknown'] as const)(
    'renders historical usage-limit text with a %s fact',
    (fact) => {
      const historicalRow: unknown =
        fact === 'text-only'
          ? { ...row, failure: undefined }
          : fact === 'unknown'
            ? {
                ...row,
                failure: {
                  ...row.failure,
                  kind: 'usageLimitReached' as const,
                  futureLimit: true
                }
              }
            : row
      if (!isAdmissibleAgentJournalItemBody(historicalRow) || historicalRow.kind !== 'status') {
        throw new Error('Historical status fixture was not admitted')
      }
      if (fact === 'unknown') {
        expect(historicalRow.failure).toEqual({ ...row.failure, futureLimit: true })
      }
      renderStatus(historicalRow, null, false, false, 'Claude')
      if (fact === 'typed') {
        expect(
          screen.getByText(/^Claude hit its session limit\. It resets at \S.*\.$/u)
        ).toBeInTheDocument()
        expect(screen.queryByText(/Send a message once it resets/)).toBeNull()
      } else {
        expect(screen.getByText(row.text)).toBeInTheDocument()
      }
      expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull()
    }
  )
})
