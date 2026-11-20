import { vi } from 'vitest'
import type { RuntimeTerminalSend } from '../../../shared/terminal/runtime/runtime-terminal-send-contract'
import type { PtyLivenessVerdict } from '../../../shared/terminal/pty/lifecycle/pty-liveness-verdict'
import type { LaunchedAgentForeground } from '../terminal/wait/launched-agent-foreground'
import type { HubQuestionTerminal } from './agent-hub-questions'
import { PANE } from '../../external-conversations/external-conversation.test-fixture'

/** A terminal that records the raw keys an answer writes, and can exit or be replaced. */
export function fakeTerminal() {
  const state: {
    ptyId: string | null
    incarnation: number
    liveness: PtyLivenessVerdict | null
  } = { ptyId: 'pty-1', incarnation: 1, liveness: null }
  const current = (): string =>
    `inc-${state.ptyId}${state.incarnation > 1 ? `-${state.incarnation}` : ''}`
  const keys: string[] = []
  const sendTerminal = vi.fn(
    async (
      handle: string,
      action: { text?: string },
      options: {
        beforeWrite?: (ptyId: string) => unknown
        reserveWrite?: (ptyId: string) => void
      }
    ): Promise<RuntimeTerminalSend> => {
      if (!state.ptyId) {
        throw new Error('terminal_not_writable')
      }
      await options.beforeWrite?.(state.ptyId)
      options.reserveWrite?.(state.ptyId)
      keys.push(action.text ?? '')
      return { handle, accepted: true, bytesWritten: 1, writeSettlement: { outcome: 'accepted' } }
    }
  )
  const terminal = {
    getTerminalHandleForPaneKey: (paneKey: string) =>
      paneKey === PANE && state.ptyId ? 'term-1' : null,
    getTerminalPromptRequestBinding: () => {
      if (!state.ptyId) {
        throw new Error('terminal_not_writable')
      }
      return { ptyId: state.ptyId, processIncarnation: current(), generation: 1 }
    },
    sendTerminal,
    readLaunchedAgentForeground: vi.fn(
      async (_ptyId: string): Promise<LaunchedAgentForeground> => 'agent'
    ),
    subscribeToTerminalData: () => () => {}
  } satisfies HubQuestionTerminal
  return {
    terminal,
    state,
    keys,
    sendTerminal,
    exit() {
      state.ptyId = null
    },
    replace() {
      state.incarnation += 1
    }
  }
}
