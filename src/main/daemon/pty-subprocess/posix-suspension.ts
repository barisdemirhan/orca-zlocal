import {
  readPosixPtyProcessTable,
  isPosixPtyRootStopped,
  getPosixPtyProcessGroups,
  signalPosixPtyProcessGroups
} from '../../pty/posix-pty-process-groups'
import type { TerminalSuspensionResult } from '../../../shared/terminal-suspension'

export async function changePosixPtySuspension(
  pid: number,
  isCurrent: () => boolean,
  suspended?: boolean
): Promise<TerminalSuspensionResult['state']> {
  if (process.platform === 'win32') {
    return 'unsupported'
  }
  if (!isCurrent()) {
    return 'unverifiable'
  }
  try {
    if (suspended !== undefined) {
      signalPosixPtyProcessGroups(pid, suspended ? 'SIGSTOP' : 'SIGCONT', () => {
        throw new Error('PTY process group ownership cannot be verified')
      })
    }
    const table = await readPosixPtyProcessTable(pid)
    if (!isCurrent() || !getPosixPtyProcessGroups(table, pid)?.length) {
      return 'unverifiable'
    }
    const stopped = isPosixPtyRootStopped(table, pid)
    if (suspended !== undefined && stopped !== suspended) {
      return 'unverifiable'
    }
    return stopped ? 'suspended' : 'awake'
  } catch {
    return 'unverifiable'
  }
}
