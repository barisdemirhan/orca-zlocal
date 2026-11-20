// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useClaudeSessionModel } from './use-claude-session-model'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

it('reads the current session from a shared fresh scan and clears the model when no session owns the hover', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(200_000)
  const scan = vi.fn(async () => [
    { sessionId: 'first', model: 'opus' },
    { sessionId: 'second', model: 'sonnet' }
  ])
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { claudeUsage: { getRecentSessions: scan } }
  })
  const initialProps: { id: string | null } = { id: 'first' }
  const hook = renderHook(({ id }: { id: string | null }) => useClaudeSessionModel(id), {
    initialProps
  })
  await act(async () => {
    await Promise.resolve()
  })
  expect(hook.result.current).toBe('opus')
  hook.rerender({ id: 'second' })
  expect(hook.result.current).toBe('sonnet')
  hook.rerender({ id: null })
  expect(hook.result.current).toBeNull()
  expect(scan).toHaveBeenCalledOnce()
})
