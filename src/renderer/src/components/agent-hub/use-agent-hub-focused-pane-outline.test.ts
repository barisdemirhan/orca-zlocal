/** @vitest-environment happy-dom */
import { renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'
import { useAgentHubFocusedPaneOutline } from './use-agent-hub-focused-pane-outline'

it('switches the focused-pane outline on for the app only while enabled', () => {
  const hook = renderHook(({ enabled }) => useAgentHubFocusedPaneOutline(enabled), {
    initialProps: { enabled: true }
  })
  expect(document.documentElement.hasAttribute('data-agent-hub-focused-pane-outline')).toBe(true)
  hook.rerender({ enabled: false })
  expect(document.documentElement.hasAttribute('data-agent-hub-focused-pane-outline')).toBe(false)
})
