import { isPtyLocked } from '@/lib/pane-manager/mobile-driver-state'
import { isOrbPtyInputProtected } from '../../agent-hub/agent-hub-orb-operation-target'
import type { ConnectPanePtySession } from './connect-pane-pty-session'

export function dropProtectedPtyInput(
  session: ConnectPanePtySession,
  ptyId: string | null
): boolean {
  if (!ptyId || (!isPtyLocked(ptyId) && !isOrbPtyInputProtected(ptyId))) {
    return false
  }
  session.clearPendingTerminalInputIntent()
  return true
}
