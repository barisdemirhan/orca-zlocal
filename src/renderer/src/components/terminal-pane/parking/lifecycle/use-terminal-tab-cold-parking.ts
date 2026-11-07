/**
 * Per-tab hidden-view parking for TerminalPaneOverlayLayer.
 *
 * Why: owns the cold-park policy bookkeeping (hiddenSince tracking, recheck
 * timers, parked-set selection) and the parked byte-watcher reconciliation so
 * the overlay layer only consumes the final parked tab set when deciding to
 * render a slot as null.
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useTerminalMountRetentionMembership } from '../../terminal-mount-retention-leases'
import { useShallow } from 'zustand/react/shallow'
import type { TerminalTab } from '../../../../../../shared/workspace-layout/terminal-tab-types'
import { useAppStore } from '../../../../store/index'
import {
  findActivityTerminalPortal,
  type ActivityTerminalPortalTarget
} from '../../../activity/activity-terminal-portal'
import { getTerminalTabColdParkRecheckDelayMs } from '../retention/terminal-cold-park-recheck-deadlines'
import {
  clearTerminalTabColdParkRecheckTimers,
  reconcileTerminalTabColdParkRecheckTimers,
  type TerminalTabColdParkRecheckTimers
} from '../retention/terminal-cold-park-recheck-timers'
import {
  TERMINAL_TAB_COLD_PARK_DELAY_MS,
  selectColdParkedTerminalTabs
} from '../retention/terminal-hidden-view-parking'
import { selectPairedRuntimeParkingEnvironmentIdsFromState } from '../retention/paired-runtime-parking-capabilities'
import type { ParkVerdictFlipRecord } from '../verdict/terminal-park-verdict-flip-telemetry'
import {
  haveSameTerminalTabIds,
  useTerminalParkVerdictPin
} from '../verdict/use-terminal-park-verdict-pin'
import { withholdUnparkableTerminalTabs } from '../retention/terminal-cold-park-withheld-tabs'
import { getTerminalParkingPolicyOverrides } from '../instrumentation/terminal-parking-e2e-overrides'
import { useTerminalEvictionExemption } from '../../use-terminal-eviction-exemption'
import { selectSleepingRecordParkExemptTabIds } from '../retention/sleeping-record-park-exemption'
import { usePendingStartupParkPresence } from '../retention/terminal-pending-startup-park-presence'
import { canWatcherCoverParkedTerminalTab } from '../output-watchers/terminal-parked-tab-watchers'
import { captureNewlyParkedTerminalTabs } from '../capture/parked-terminal-tab-capture-episodes'
import { createTerminalTabActivationOrder } from '../../terminal-tab-activation-order'
import { buildTerminalTabColdParkCandidates } from '../retention/terminal-tab-park-candidates'
import {
  getTerminalParkingAssignmentsKey,
  getTerminalParkingInputsKey,
  useParkedTerminalWatcherSynchronization
} from './use-parked-terminal-watcher-synchronization'
import {
  getTerminalPaneSplitMountLeaseTabIds,
  subscribeTerminalPaneSplitMountLeases
} from '../../terminal-pane-split-request-routing'

type TerminalOverlayTabAssignment = {
  groupId: string
  isActiveInGroup: boolean
}

export function useTerminalTabColdParking(args: {
  worktreeId: string
  terminalTabs: readonly TerminalTab[]
  assignments: ReadonlyMap<string, TerminalOverlayTabAssignment>
  isWorktreeActive: boolean
  activeTerminalTabId: string | null
  /** Worktree-level park verdict from Terminal.tsx. */
  coldParkTerminalPanes: boolean
  /** Force-parks may contain unrestorable live PTYs; keep exempt panes mounted to avoid orphaning them. */
  isForceParked?: boolean
  /** Keep hidden startup probes mounted for their first xterm fit. */
  shouldMeasureHiddenWorktree: boolean
  activityTerminalPortals: ActivityTerminalPortalTarget[]
  /** Activation-deferred tabs need parked watchers; targeted restrictions stay bounded. */
  activationDeferredMountTabIds?: ReadonlySet<string> | null
}): ReadonlySet<string> {
  const {
    worktreeId,
    terminalTabs,
    assignments,
    isWorktreeActive,
    activeTerminalTabId,
    coldParkTerminalPanes,
    isForceParked = false,
    shouldMeasureHiddenWorktree,
    activityTerminalPortals,
    activationDeferredMountTabIds
  } = args
  const { tabIds: retainedTabIds, key: retainedTabIdsKey } =
    useTerminalMountRetentionMembership(worktreeId)
  const terminalParkingInputsKey = useMemo(
    () => getTerminalParkingInputsKey(terminalTabs),
    [terminalTabs]
  )
  const terminalParkingAssignmentsKey = useMemo(
    () => getTerminalParkingAssignmentsKey(assignments),
    [assignments]
  )
  const terminalParkingTabsDependency = coldParkTerminalPanes
    ? terminalParkingInputsKey
    : terminalTabs
  const terminalParkingAssignmentsDependency = coldParkTerminalPanes
    ? terminalParkingAssignmentsKey
    : assignments
  const pendingStartupByTabId = usePendingStartupParkPresence(terminalTabs)
  const terminalParkingEnabled = useAppStore(
    (state) => state.settings?.terminalHiddenViewParking !== false
  )
  const terminalSshParkingEnabled = useAppStore(
    (state) => state.settings?.terminalSshViewParking !== false
  )
  const terminalPaneSplitMountLeaseTabIds = useSyncExternalStore(
    subscribeTerminalPaneSplitMountLeases,
    getTerminalPaneSplitMountLeaseTabIds,
    getTerminalPaneSplitMountLeaseTabIds
  )
  const pairedRuntimeParkingEnvironmentIds = useAppStore(
    selectPairedRuntimeParkingEnvironmentIdsFromState
  )
  // Subscribe to worktree-scoped presence; the app-global map rerenders this worktree for unrelated writes.
  const sleepingRecordOwnedTabIds = useAppStore(
    useShallow((state) => selectSleepingRecordParkExemptTabIds(state, worktreeId))
  )
  const terminalTabHiddenSinceRef = useRef(new Map<string, number>())
  // Why: view switches hide every tab at once, so the park clock cannot rank them.
  const terminalTabActivationOrderRef = useRef<ReturnType<typeof createTerminalTabActivationOrder>>(
    undefined!
  )
  terminalTabActivationOrderRef.current ??= createTerminalTabActivationOrder()
  // Preserve hiddenSince through measurement to match worktree deadlines; cooldown prevents immediate re-park afterward.
  const wasMeasuringHiddenWorktreeRef = useRef(false)
  const measureParkCooldownUntilRef = useRef<number | null>(null)
  const terminalTabParkingTimersRef = useRef<TerminalTabColdParkRecheckTimers>(new Map())
  const parkVerdictRecordsRef = useRef(new Map<string, ParkVerdictFlipRecord>())
  const parkedTabCaptureDoneRef = useRef(new Set<string>())
  const [terminalTabParkingRevision, setTerminalTabParkingRevision] = useState(0)
  const [coldParkedTerminalTabIds, setColdParkedTerminalTabIds] = useState<ReadonlySet<string>>(
    () => new Set()
  )
  // Mirrors the committed park set; written only from the post-commit effect below.
  const coldParkedTerminalTabIdsRef = useRef(coldParkedTerminalTabIds)

  useEffect(() => {
    const timers = terminalTabParkingTimersRef.current
    return () => clearTerminalTabColdParkRecheckTimers(timers)
  }, [])

  // Schedule pending hysteresis deadlines instead of polling.
  useEffect(() => {
    const timers = terminalTabParkingTimersRef.current
    const nowMs = Date.now()
    const overrides = getTerminalParkingPolicyOverrides()
    const currentTerminalTabIds = new Set(terminalTabs.map((tab) => tab.id))
    const portalTabIds = new Set(
      activityTerminalPortals
        .filter((portal) => portal.worktreeId === worktreeId)
        .map((portal) => portal.tabId)
    )
    for (const tabId of Array.from(terminalTabHiddenSinceRef.current.keys())) {
      if (!currentTerminalTabIds.has(tabId)) {
        terminalTabHiddenSinceRef.current.delete(tabId)
      }
    }
    terminalTabActivationOrderRef.current.retainTabIds(currentTerminalTabIds)

    // Measurement preserves hiddenSince, so its end needs cooldown to prevent immediate re-park.
    if (shouldMeasureHiddenWorktree) {
      wasMeasuringHiddenWorktreeRef.current = true
    } else {
      if (wasMeasuringHiddenWorktreeRef.current) {
        measureParkCooldownUntilRef.current =
          nowMs + (overrides.coldParkDelayMs ?? TERMINAL_TAB_COLD_PARK_DELAY_MS)
      }
      wasMeasuringHiddenWorktreeRef.current = false
    }
    // A visible worktree ends measurement outright and owes no re-park cooldown.
    if (isWorktreeActive) {
      measureParkCooldownUntilRef.current = null
    }

    const candidates = buildTerminalTabColdParkCandidates({
      terminalTabs,
      assignments,
      isWorktreeActive,
      activeTerminalTabId,
      portalTabIds,
      shouldMeasureHiddenWorktree,
      hiddenSinceByTabId: terminalTabHiddenSinceRef.current,
      activationOrder: terminalTabActivationOrderRef.current,
      nowMs
    }).map((candidate) => ({
      ...candidate,
      hasMountRetentionLease: retainedTabIds.has(candidate.id)
    }))

    const nextColdParkedTerminalTabIds = selectColdParkedTerminalTabs({
      worktreeId,
      terminalTabs: candidates,
      pendingStartupByTabId,
      parkingEnabled: terminalParkingEnabled,
      nowMs,
      parkCooldownUntilMs: measureParkCooldownUntilRef.current,
      restorePolicy: {
        sshParkingEnabled: terminalSshParkingEnabled,
        pairedRuntimeParkingEnvironmentIds
      },
      ...overrides
    })
    const { parkedTabIds, parkVerdictPinUntilMsByTabId } = withholdUnparkableTerminalTabs({
      worktreeId,
      terminalTabs,
      coldParkedTabIds: nextColdParkedTerminalTabIds,
      parkVerdictRecords: parkVerdictRecordsRef.current,
      nowMs
    })
    // Capture scrollback while panes are still mounted, before committing the park unmount.
    captureNewlyParkedTerminalTabs(worktreeId, parkedTabIds, parkedTabCaptureDoneRef.current)
    // Compare via ref before dispatch: no-op updater dispatches can still hit React’s global nested-update limit inside a commit cascade.
    if (!haveSameTerminalTabIds(coldParkedTerminalTabIdsRef.current, parkedTabIds)) {
      coldParkedTerminalTabIdsRef.current = parkedTabIds
      setColdParkedTerminalTabIds(parkedTabIds)
    }

    const recheckDeadlineMsByTabId = new Map<string, number>()
    for (const candidate of candidates) {
      if (
        candidate.isVisible ||
        candidate.hasActivityTerminalPortal ||
        candidate.hasMountRetentionLease ||
        parkedTabIds.has(candidate.id)
      ) {
        continue
      }
      const delayMs = getTerminalTabColdParkRecheckDelayMs({
        parkingEnabled: terminalParkingEnabled,
        hiddenSinceMs: candidate.hiddenSinceMs,
        parkCooldownUntilMs: measureParkCooldownUntilRef.current,
        // Why: pin expiry may be the only remaining wakeup after damping stops churn.
        parkVerdictPinUntilMs: parkVerdictPinUntilMsByTabId.get(candidate.id) ?? null,
        nowMs,
        ...overrides
      })
      if (delayMs !== null && delayMs > 0) {
        recheckDeadlineMsByTabId.set(candidate.id, nowMs + delayMs)
      }
    }

    reconcileTerminalTabColdParkRecheckTimers({
      timers,
      deadlineMsByTabId: recheckDeadlineMsByTabId,
      nowMs,
      onDeadline: () => setTerminalTabParkingRevision((revision) => revision + 1)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- semantic keys own the tab and assignment dependencies.
  }, [
    activityTerminalPortals,
    retainedTabIdsKey,
    activeTerminalTabId,
    isWorktreeActive,
    pendingStartupByTabId,
    pairedRuntimeParkingEnvironmentIds,
    shouldMeasureHiddenWorktree,
    terminalParkingEnabled,
    terminalSshParkingEnabled,
    terminalTabParkingRevision,
    terminalParkingAssignmentsDependency,
    terminalParkingTabsDependency,
    worktreeId
  ])

  const evictionExemptTerminalTabIds = useTerminalEvictionExemption(
    worktreeId,
    terminalTabs,
    isForceParked
  )

  // Why: the park verdict before damping — worktree-level park (prop from
  // Terminal.tsx) or per-tab cold park, never portal-hosted tabs. Render and
  // the watcher-sync effect must share the pinned result below so watcher
  // lifecycle tracks the committed unmounts.
  const candidateParkedTerminalTabIds = useMemo(() => {
    const parked = new Set<string>()
    for (const terminalTab of terminalTabs) {
      const assignment = assignments.get(terminalTab.id)
      const isVisible = Boolean(isWorktreeActive && assignment && assignment.isActiveInGroup)
      const hasActivityTerminalPortal =
        findActivityTerminalPortal(activityTerminalPortals, {
          worktreeId,
          tabId: terminalTab.id
        }) !== null
      if (
        (coldParkTerminalPanes ||
          (!isVisible &&
            coldParkedTerminalTabIds.has(terminalTab.id) &&
            // Why: a pane owning a sleeping-session record must stay mountable
            // on an active worktree — parked it can never cold-restore, so the
            // agent's resume strands until the user reveals the tab. Scoped to
            // per-tab parks: the worktree-level park clears on activation.
            !sleepingRecordOwnedTabIds.has(terminalTab.id))) &&
        !hasActivityTerminalPortal &&
        !retainedTabIds.has(terminalTab.id) &&
        // Why: a force-parked worktree's eviction-exempt tabs keep their
        // mounted panes — a remount would orphan their live pty. Scoped to
        // force-parks: ordinary parks never contain exempt tabs (eligibility
        // requires every tab restorable, so the memo is empty for them).
        !evictionExemptTerminalTabIds.has(terminalTab.id) &&
        // Why: CLI splits against a parked tab replay as soon as its exact pane remounts.
        !terminalPaneSplitMountLeaseTabIds.has(terminalTab.id) &&
        // Why: the hidden-measuring startup probe needs mounted panes; gate
        // here too so the reveal lands in the same render that starts it.
        !shouldMeasureHiddenWorktree
      ) {
        parked.add(terminalTab.id)
      }
      // Why: activation-deferred tabs render no pane regardless of the park
      // policy, so watchers must own their side effects immediately. Targeted
      // restrictions do not enter this set or add a new eager watcher burst.
      if (
        activationDeferredMountTabIds?.has(terminalTab.id) &&
        !hasActivityTerminalPortal &&
        !retainedTabIds.has(terminalTab.id) &&
        canWatcherCoverParkedTerminalTab(worktreeId, terminalTab)
      ) {
        parked.add(terminalTab.id)
      }
    }
    return parked
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- Semantic lease membership survives discarded memo caches.
  }, [
    activityTerminalPortals,
    retainedTabIdsKey,
    assignments,
    coldParkTerminalPanes,
    coldParkedTerminalTabIds,
    activationDeferredMountTabIds,
    evictionExemptTerminalTabIds,
    isWorktreeActive,
    shouldMeasureHiddenWorktree,
    sleepingRecordOwnedTabIds,
    terminalTabs,
    terminalPaneSplitMountLeaseTabIds,
    worktreeId
  ])

  // Damp the final rendered set because worktree parks and activation deferral bypass the cold-park candidate filter (#15136).
  const parkedTerminalTabIds = useTerminalParkVerdictPin({
    records: parkVerdictRecordsRef,
    terminalTabs,
    candidateParkedTabIds: candidateParkedTerminalTabIds,
    allowSustainedPin: !isForceParked
  })

  // Sync in the park/reveal effect flush: dispose watchers before remounted-pane IPC and start them after unmount capture.
  useParkedTerminalWatcherSynchronization({
    worktreeId,
    terminalTabs,
    assignmentsKey: terminalParkingAssignmentsKey,
    inputsKey: terminalParkingInputsKey,
    parkedTabIds: parkedTerminalTabIds,
    activationDeferredMountTabIds
  })

  return parkedTerminalTabIds
}
