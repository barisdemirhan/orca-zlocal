import type {
  TerminalSuspensionOptions,
  TerminalSuspensionResult
} from '../../shared/terminal-suspension'
import type { Session } from './sessions/session'
import { getAliveTerminalHostSession } from './terminal-host/terminal-host-session-access'
import { changePosixPtySuspension } from './pty-subprocess/posix-suspension'

export async function changeTerminalHostSuspension(
  sessions: ReadonlyMap<string, Session>,
  sessionId: string,
  options: TerminalSuspensionOptions
): Promise<TerminalSuspensionResult> {
  const session = getAliveTerminalHostSession(sessions, sessionId)
  if (options.suspended !== undefined && options.expectedIncarnationId !== session.incarnationId) {
    return { state: 'unverifiable' }
  }
  const state = await changePosixPtySuspension(
    session.pid,
    () => sessions.get(sessionId) === session && session.isAlive && !session.isTerminating,
    options.suspended
  )
  return sessions.get(sessionId) === session && session.isAlive
    ? { state, incarnationId: session.incarnationId }
    : { state: 'unverifiable' }
}
