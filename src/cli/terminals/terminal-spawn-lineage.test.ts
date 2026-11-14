import { afterEach, describe, expect, it, vi } from 'vitest'
import { TERMINAL_HANDLERS } from './terminal'
import type { RuntimeClient } from '../runtime/client'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('CLI terminal creator identity', () => {
  it.each(['terminal create', 'terminal split'] as const)(
    'sends the same environment caller for %s, and omits it outside an Orca terminal',
    async (command) => {
      const call = vi.fn().mockResolvedValue({ ok: true, result: {}, _meta: {} })
      vi.spyOn(console, 'log').mockImplementation(() => {})
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: Explicit worktree and terminal selectors only use call and isRemote on this fixture.
      const client = { call, isRemote: true } as unknown as RuntimeClient
      const flags = new Map<string, string>([
        ['worktree', 'id:folder'],
        ['terminal', 'term-target']
      ])
      vi.stubEnv('ORCA_TERMINAL_HANDLE', 'term-parent')
      await TERMINAL_HANDLERS[command]({ flags, client, cwd: '/folder', json: true })
      expect(call).toHaveBeenLastCalledWith(
        command.replace(' ', '.'),
        expect.objectContaining({ callerTerminalHandle: 'term-parent' })
      )
      vi.stubEnv('ORCA_TERMINAL_HANDLE', '')
      await TERMINAL_HANDLERS[command]({ flags, client, cwd: '/folder', json: true })
      expect(call.mock.calls.at(-1)?.[1]).not.toHaveProperty('callerTerminalHandle')
    }
  )
})
