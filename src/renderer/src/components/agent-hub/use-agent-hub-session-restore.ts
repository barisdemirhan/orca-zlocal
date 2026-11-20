import { useEffect, useEffectEvent } from 'react'
import { useAppStore } from '@/store'
import { rememberAgentHubCanvasParked, subscribeAgentHubCanvas } from './agent-hub-canvas-store'
import { subscribeAgentHubFamilyBars } from './agent-hub-family-bar'
import { subscribeAgentHubMirrorPlaces } from './agent-hub-mirror-places'
import { commitAgentHubMirrorState, subscribeAgentHubMirrors } from './agent-hub-mirror-store'
import {
  applyAgentHubSession,
  captureAgentHubSession,
  resolveAgentHubSession
} from './agent-hub-session-restore'
import {
  clearAgentHubSessionSnapshot,
  readAgentHubSessionRecord,
  writeAgentHubSessionSnapshot
} from './agent-hub-session-snapshot'

const WRITE_DEBOUNCE_MS = 400

// Once per renderer load: a hub that mounts again (it moved to the status bar) restores nothing.
let settled = false

/** Test seam: the next mount restores again. */
export function resetAgentHubSessionRestoreForTest(): void {
  settled = false
}

/**
 * Keeps the saved snapshot in step with the stage, a moment after each change and once more as
 * the window unloads. Stopping writes what is pending, unless the hub itself was turned off:
 * then the snapshot is dropped, so nothing from this session comes back when it is turned on.
 */
function keepAgentHubSessionSaved(preserveDamaged: boolean): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  const write = (): void => {
    timer = null
    if (!preserveDamaged) {
      writeAgentHubSessionSnapshot(captureAgentHubSession())
    }
  }
  const schedule = (): void => {
    if (timer !== null) {
      clearTimeout(timer)
    }
    timer = setTimeout(write, WRITE_DEBOUNCE_MS)
  }
  const flush = (): void => {
    if (timer !== null) {
      clearTimeout(timer)
      write()
    }
  }
  const stops = [
    subscribeAgentHubMirrors(schedule),
    subscribeAgentHubMirrorPlaces(schedule),
    subscribeAgentHubCanvas(schedule),
    subscribeAgentHubFamilyBars(schedule)
  ]
  window.addEventListener('beforeunload', flush)
  // Why at once: what was just restored (or left out) is the state the next launch should find.
  schedule()
  return () => {
    stops.forEach((stop) => stop())
    window.removeEventListener('beforeunload', flush)
    const settings = useAppStore.getState().settings
    if (settings && settings.experimentalAgentHub !== true) {
      if (timer !== null) {
        clearTimeout(timer)
      }
      clearAgentHubSessionSnapshot()
      commitAgentHubMirrorState({ windows: [], chips: [] })
      rememberAgentHubCanvasParked([])
    } else {
      flush()
    }
  }
}

/**
 * Brings the hub's stage back after a restart (mirrors, tray, canvas, tab toggles, hidden
 * worker bars) and keeps it saved from then on. Why it waits for the session: a saved mirror is
 * only ids, and its tab and workspace exist once the workspace session has been hydrated. A
 * degraded start never hydrates, so it restores nothing and leaves the snapshot as it is.
 */
export function useAgentHubSessionRestore(restoreOnLaunch: boolean, canvas: boolean): void {
  const ready = useAppStore(
    (state) =>
      state.workspaceSessionReady &&
      state.hydrationSucceeded &&
      state.terminalStartupRestorationReady
  )
  const restoreOnce = useEffectEvent(() => {
    if (settled) {
      return
    }
    settled = true
    const snapshot = restoreOnLaunch ? readAgentHubSessionRecord().snapshot : null
    if (snapshot) {
      applyAgentHubSession(
        resolveAgentHubSession(snapshot, useAppStore.getState(), {
          canvas,
          viewport: { width: window.innerWidth, height: window.innerHeight },
          now: Date.now()
        })
      )
    }
  })
  useEffect(() => {
    if (!ready) {
      return
    }
    restoreOnce()
    const record = readAgentHubSessionRecord()
    return keepAgentHubSessionSaved(
      record.status === 'unsupported' || (record.status === 'damaged' && !record.snapshot)
    )
  }, [ready])
}
