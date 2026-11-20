import type { Session } from './sessions/session'

export function reapTerminalHostSession(
  sessions: Map<string, Session>,
  id: string,
  onReaped?: (id: string) => void
): void {
  const session = sessions.get(id)
  if (!session || session.isAlive) {
    return
  }
  session.dispose()
  sessions.delete(id)
  onReaped?.(id)
}
