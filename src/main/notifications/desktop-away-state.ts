import { DESKTOP_AWAY_SECONDS } from '../../shared/app-lifecycle/presence/desktop-away-threshold'
import type { AgentHubPresence } from '../../shared/agent-hub-requests'

type IdleMonitor = {
  getSystemIdleState(threshold: number): string
  getSystemIdleTime(): number
}

export function readDesktopAwayState(monitor: IdleMonitor): boolean | undefined {
  try {
    const state = monitor.getSystemIdleState(DESKTOP_AWAY_SECONDS)
    if (state === 'locked' || state === 'idle') {
      return true
    }
    const idle = monitor.getSystemIdleTime()
    return Number.isFinite(idle) && idle >= 0 ? idle >= DESKTOP_AWAY_SECONDS : undefined
  } catch {
    // Unknown presence must not silence a phone.
    return undefined
  }
}

export function readDesktopPresence(monitor: IdleMonitor): AgentHubPresence | undefined {
  try {
    const away = readDesktopAwayState(monitor)
    const idle = monitor.getSystemIdleTime()
    if (away === undefined || !Number.isFinite(idle) || idle < 0) {
      return undefined
    }
    return { present: !away, idleMinutes: idle / 60 }
  } catch {
    return undefined
  }
}
