import {
  acquireMicrophoneCaptureLease,
  MicrophoneCaptureBusyError,
  type MicrophoneCaptureRelease
} from './microphone-capture-lease'
import { openMicrophoneCaptureStream } from './microphone-devices'

export class MicrophoneCaptureSession {
  private generation = 0
  private pending = false
  private stream: MediaStream | null = null
  private releaseLease: MicrophoneCaptureRelease | null = null
  private releaseFinished = Promise.resolve()
  private openingFinished = Promise.resolve()

  constructor(private readonly requireCrossWindow = false) {}

  async open(preference: { deviceId?: string | null; label?: string | null } = {}) {
    if (this.pending || this.stream) {
      throw new MicrophoneCaptureBusyError()
    }
    const generation = ++this.generation
    this.pending = true
    let finishOpening = (): void => {}
    this.openingFinished = new Promise<void>((resolve) => {
      finishOpening = resolve
    })
    try {
      await this.releaseFinished
      if (generation !== this.generation) {
        return null
      }
      this.releaseLease = await acquireMicrophoneCaptureLease({
        requireCrossWindow: this.requireCrossWindow
      })
      if (generation !== this.generation) {
        await this.release()
        return null
      }
      const capture = await openMicrophoneCaptureStream({
        preferredDeviceId: preference.deviceId,
        preferredDeviceLabel: preference.label,
        getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
        enumerateDevices: navigator.mediaDevices?.enumerateDevices
          ? () => navigator.mediaDevices.enumerateDevices()
          : undefined
      })
      if (generation !== this.generation) {
        capture.stream.getTracks().forEach((track) => track.stop())
        await this.release()
        return null
      }
      this.stream = capture.stream
      return capture
    } catch (error) {
      await this.release()
      throw error
    } finally {
      this.pending = false
      finishOpening()
    }
  }

  stop(expectedStream?: MediaStream): Promise<void> {
    if (expectedStream && expectedStream !== this.stream) {
      return Promise.resolve()
    }
    this.generation += 1
    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null
    return this.pending ? this.openingFinished : this.release()
  }

  private release(): Promise<void> {
    if (this.releaseLease) {
      this.releaseFinished = this.releaseLease()
    }
    this.releaseLease = null
    return this.releaseFinished
  }
}
