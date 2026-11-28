// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import {
  acquireMicrophoneCaptureLease,
  MicrophoneCaptureBusyError,
  MicrophoneCaptureUnavailableError,
  microphoneCaptureIsBusy
} from './microphone-capture-lease'

afterEach(() => vi.unstubAllGlobals())

it('clears pending local ownership when another window holds the microphone lock', async () => {
  vi.stubGlobal('isSecureContext', true)
  vi.stubGlobal('navigator', {
    locks: { request: vi.fn(async (_name, _options, callback) => callback(null)) }
  })
  await expect(acquireMicrophoneCaptureLease({ requireCrossWindow: true })).rejects.toBeInstanceOf(
    MicrophoneCaptureBusyError
  )
  expect(microphoneCaptureIsBusy()).toBe(false)
})

it('holds the browser lock until release and makes repeated release harmless to the next owner', async () => {
  let lockHeld = false
  vi.stubGlobal('isSecureContext', true)
  vi.stubGlobal('navigator', {
    locks: {
      request: vi.fn(async (_name, _options, callback) => {
        if (lockHeld) {
          return callback(null)
        }
        lockHeld = true
        try {
          return await callback({})
        } finally {
          lockHeld = false
        }
      })
    }
  })
  const release = await acquireMicrophoneCaptureLease({ requireCrossWindow: true })
  expect(lockHeld).toBe(true)
  await expect(acquireMicrophoneCaptureLease()).rejects.toBeInstanceOf(MicrophoneCaptureBusyError)
  await release()
  const releaseNext = await acquireMicrophoneCaptureLease({ requireCrossWindow: true })
  await release()
  expect(microphoneCaptureIsBusy()).toBe(true)
  await releaseNext()
  expect(lockHeld).toBe(false)
})

it('cleans a rejected browser lock, keeps legacy dictation available, and refuses uncoordinated Live capture', async () => {
  vi.stubGlobal('isSecureContext', true)
  vi.stubGlobal('navigator', {
    locks: {
      request: vi.fn(async () => {
        throw new DOMException('Opaque origin', 'SecurityError')
      })
    }
  })
  await expect(acquireMicrophoneCaptureLease({ requireCrossWindow: true })).rejects.toBeInstanceOf(
    MicrophoneCaptureUnavailableError
  )
  expect(microphoneCaptureIsBusy()).toBe(false)
  const release = await acquireMicrophoneCaptureLease()
  expect(microphoneCaptureIsBusy()).toBe(true)
  await release()
  vi.stubGlobal('navigator', {})
  const legacyRelease = await acquireMicrophoneCaptureLease()
  await legacyRelease()
  await expect(acquireMicrophoneCaptureLease({ requireCrossWindow: true })).rejects.toBeInstanceOf(
    MicrophoneCaptureUnavailableError
  )
  expect(microphoneCaptureIsBusy()).toBe(false)
})
