let activeCapture: symbol | null = null
export type MicrophoneCaptureRelease = () => Promise<void>

export class MicrophoneCaptureBusyError extends Error {
  constructor() {
    super('The microphone is already in use by another recording.')
  }
}

export class MicrophoneCaptureUnavailableError extends Error {
  constructor() {
    super('Live voice is unavailable in this window.')
  }
}

export async function acquireMicrophoneCaptureLease(
  options: { requireCrossWindow?: boolean } = {}
): Promise<MicrophoneCaptureRelease> {
  if (activeCapture !== null) {
    throw new MicrophoneCaptureBusyError()
  }
  const owner = Symbol('microphone-capture')
  activeCapture = owner
  const release = (): void => {
    if (activeCapture === owner) {
      activeCapture = null
    }
  }
  if (!navigator.locks?.request || globalThis.isSecureContext === false) {
    if (options.requireCrossWindow) {
      release()
      throw new MicrophoneCaptureUnavailableError()
    }
    return async () => release()
  }
  return new Promise<MicrophoneCaptureRelease>((resolve, reject) => {
    const finished = Promise.resolve()
      .then(() =>
        navigator.locks.request(
          'orca.microphone-capture',
          { mode: 'exclusive', ifAvailable: true },
          async (lock) => {
            if (!lock) {
              release()
              reject(new MicrophoneCaptureBusyError())
              return
            }
            await new Promise<void>((unlock) => {
              resolve(async () => {
                unlock()
                await finished
              })
            })
          }
        )
      )
      .then(() => release())
      .catch(() => {
        if (options.requireCrossWindow) {
          release()
          reject(new MicrophoneCaptureUnavailableError())
        } else {
          resolve(async () => release())
        }
      })
  })
}

export function microphoneCaptureIsBusy(): boolean {
  return activeCapture !== null
}
