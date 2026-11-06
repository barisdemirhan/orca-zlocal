import {
  isPosixPtyRootStopped,
  getPosixPtyProcessGroups,
  signalPosixPtyProcessGroups
} from '../../pty/process-retirement/posix-pty-process-groups'
import { readPosixPtyProcessTable } from '../../pty/process-retirement/posix-pty-process-table'
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
      await signalPosixPtyProcessGroups(
        pid,
        suspended ? 'SIGSTOP' : 'SIGCONT',
        () => {
          throw new Error('PTY process group ownership cannot be verified')
        },
        { ownsRoot: isCurrent }
      )
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
