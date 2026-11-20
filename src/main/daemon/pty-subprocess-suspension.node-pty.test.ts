import { afterEach, expect, it } from 'vitest'
import { spawn } from 'node-pty'
import { tmpdir } from 'node:os'
import { changePosixPtySuspension } from './pty-subprocess/posix-suspension'

let terminal: ReturnType<typeof spawn> | undefined
afterEach(async () => {
  if (!terminal) {
    return
  }
  await changePosixPtySuspension(terminal.pid, () => true, false)
  terminal.kill()
  terminal = undefined
})

it.skipIf(process.platform === 'win32')(
  'pauses and resumes the same real PTY and its foreground job',
  async () => {
    const shell = spawn('/bin/sh', ['-c', 'while :; do printf tick; sleep 0.03; done'], {
      cols: 80,
      rows: 24,
      cwd: tmpdir(),
      env: { PATH: '/usr/bin:/bin' }
    })
    terminal = shell
    let output = ''
    shell.onData((data) => {
      output += data
    })
    await expect.poll(() => output.length).toBeGreaterThan(8)
    expect(await changePosixPtySuspension(shell.pid, () => true, true)).toBe('suspended')
    await new Promise((resolve) => setTimeout(resolve, 100))
    const frozen = output.length
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(output.length).toBe(frozen)
    expect(await changePosixPtySuspension(shell.pid, () => true)).toBe('suspended')
    expect(await changePosixPtySuspension(shell.pid, () => true, false)).toBe('awake')
    await expect.poll(() => output.length).toBeGreaterThan(frozen)
    expect(await changePosixPtySuspension(shell.pid, () => false, true)).toBe('unverifiable')
  }
)
