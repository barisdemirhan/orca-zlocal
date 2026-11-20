/** @vitest-environment happy-dom */
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  useDictationShownInMirror,
  useMirrorShowsDictation
} from './agent-hub-mirror-dictation-display'

describe('dictation shown in a mirror', () => {
  it('hands the indicator back to the app when the showing mirror goes away', () => {
    const app = renderHook(() => useDictationShownInMirror())
    expect(app.result.current).toBe(false)

    const mirror = renderHook(({ showing }) => useMirrorShowsDictation(showing), {
      initialProps: { showing: true }
    })
    expect(app.result.current).toBe(true)

    // Minimized or closed mid-dictation: the mirror unmounts, the dictation goes on.
    mirror.unmount()
    expect(app.result.current).toBe(false)
  })

  it('does not claim the indicator for a mirror that is not showing the dictation', () => {
    const app = renderHook(() => useDictationShownInMirror())
    const mirror = renderHook(({ showing }) => useMirrorShowsDictation(showing), {
      initialProps: { showing: false }
    })
    expect(app.result.current).toBe(false)

    mirror.rerender({ showing: true })
    expect(app.result.current).toBe(true)
    mirror.rerender({ showing: false })
    expect(app.result.current).toBe(false)
  })
})
