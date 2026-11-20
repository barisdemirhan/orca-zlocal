/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from 'vitest'
import { canCancelDictation, cancelDictation } from './agent-hub-dictation-cancel'

const listeners: (() => void)[] = []

function listen(type: string, handler: (event: Event) => void): void {
  document.addEventListener(type, handler)
  listeners.push(() => document.removeEventListener(type, handler))
}

afterEach(() => {
  listeners.splice(0).forEach((remove) => remove())
})

describe('mirror dictation cancel', () => {
  it('offers cancel only when a dictation controller says it handles it', () => {
    expect(canCancelDictation()).toBe(false)
    listen('dictation:capabilities', (event) => {
      if (event instanceof CustomEvent) {
        event.detail.cancel = true
      }
    })
    expect(canCancelDictation()).toBe(true)
  })

  it('sends the cancel action on the dictation control event', () => {
    const actions: unknown[] = []
    listen('dictation:control', (event) => {
      if (event instanceof CustomEvent) {
        actions.push(event.detail)
      }
    })
    cancelDictation()
    expect(actions).toEqual(['cancel'])
  })
})
