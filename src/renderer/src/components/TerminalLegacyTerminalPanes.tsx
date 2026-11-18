import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useAppStore } from '../store'
import { RetainedPaneHost } from './tab-group/retained-pane/RetainedPaneHost'
import { useTerminalMountRetentionLeases } from './terminal-pane/terminal-mount-retention-leases'
import TerminalPane from './terminal-pane/TerminalPane'
import { TerminalRestoringPlaceholder } from './terminal-pane/mounting/TerminalRestoringPlaceholder'
import { findActivityTerminalPortal } from './activity/activity-terminal-portal'
import { shouldMountBackgroundWorktreeTab } from './terminal/background-terminal-worktree-mount'
import type { TerminalController } from './use-terminal-controller'

export function TerminalLegacyTerminalPanes({
  controller
}: {
  controller: TerminalController
}): React.JSX.Element {
  // Why read once: switching host type remounts every pane and loses its TUI state, so a toggled
  // setting reaches this surface the next time it mounts.
  const [stableHosting] = useState(
    () => useAppStore.getState().settings?.experimentalAgentHub === true
  )
  const pendingStartupByTabId = useAppStore((state) => state.pendingStartupByTabId)
  const mountRetentionLeases = useTerminalMountRetentionLeases()
  const {
    activeTabId,
    activeTabType,
    activeView,
    activityTerminalPortals,
    backgroundMountTabIdsByWorktreeRef,
    effectiveParkedTerminalWorktreeIds,
    evictionExemptTerminalTabIds,
    handleCloseTab,
    handlePtyExit,
    measurableBackgroundWorktreeIdsRef,
    mountedWorktreeIdsRef,
    renderedActiveWorktreeId,
    tabsByWorktree,
    worktreeBrowserTabs,
    worktreeFiles,
    workspaceSurfaces
  } = controller
  return (
    <div
      className={`relative flex-1 min-h-0 overflow-hidden ${
        (activeTabType === 'editor' && worktreeFiles.length > 0) ||
        (activeTabType === 'browser' && worktreeBrowserTabs.length > 0) ||
        activeTabType === 'simulator'
          ? 'hidden'
          : ''
      }`}
    >
      {workspaceSurfaces
        .filter((workspace) => mountedWorktreeIdsRef.current.has(workspace.id))
        .map((workspace) => {
          const isVisible = activeView === 'terminal' && workspace.id === renderedActiveWorktreeId
          const shouldMeasureHiddenWorktree =
            !isVisible && measurableBackgroundWorktreeIdsRef.current.has(workspace.id)
          const shouldColdParkTerminalPanes =
            !isVisible &&
            !shouldMeasureHiddenWorktree &&
            effectiveParkedTerminalWorktreeIds.has(workspace.id)
          return (
            <div
              key={workspace.id}
              className={
                isVisible
                  ? 'absolute inset-0'
                  : shouldMeasureHiddenWorktree
                    ? 'absolute inset-0 opacity-0 pointer-events-none'
                    : 'absolute inset-0 hidden'
              }
              aria-hidden={!isVisible}
            >
              {(tabsByWorktree[workspace.id] ?? []).map((tab) => {
                const isActiveTerminalTab =
                  isVisible && tab.id === activeTabId && activeTabType === 'terminal'
                const retained = mountRetentionLeases.some(
                  (lease) => lease.worktreeId === workspace.id && lease.tabId === tab.id
                )
                if (
                  !retained &&
                  !shouldMountBackgroundWorktreeTab(
                    backgroundMountTabIdsByWorktreeRef.current.get(workspace.id) ?? null,
                    tab.id
                  )
                ) {
                  // Only startup-held tabs remain visibly deferred; reveal admits other visible tabs in this render.
                  return isActiveTerminalTab ? <TerminalRestoringPlaceholder key={tab.id} /> : null
                }
                const activityTerminalPortal = findActivityTerminalPortal(activityTerminalPortals, {
                  worktreeId: workspace.id,
                  tabId: tab.id
                })
                const isActivityPortalTab = activityTerminalPortal !== null
                if (
                  shouldColdParkTerminalPanes &&
                  !isActivityPortalTab &&
                  !retained &&
                  !evictionExemptTerminalTabIds.has(tab.id)
                ) {
                  return null
                }
                const terminalPane = (
                  <TerminalPane
                    key={`${tab.id}-${tab.generation ?? 0}`}
                    tabId={tab.id}
                    worktreeId={workspace.id}
                    cwd={tab.startupCwd ?? workspace.path}
                    isActive={
                      stableHosting && activityTerminalPortal
                        ? activityTerminalPortal.active
                        : isActiveTerminalTab || activityTerminalPortal?.active === true
                    }
                    isVisible={isActiveTerminalTab || isActivityPortalTab}
                    isWorktreeActive={isVisible || isActivityPortalTab}
                    isolatedPaneKey={activityTerminalPortal?.paneKey ?? null}
                    onPtyExit={(ptyId, exitCode) => handlePtyExit(tab.id, ptyId, exitCode)}
                    onCloseTab={(reason) => handleCloseTab(tab.id, reason)}
                  />
                )
                if (!stableHosting) {
                  return activityTerminalPortal
                    ? createPortal(
                        terminalPane,
                        activityTerminalPortal.target,
                        `activity-terminal-${tab.id}`
                      )
                    : terminalPane
                }
                return (
                  <RetainedPaneHost
                    key={tab.id}
                    groupId={undefined}
                    unanchored
                    retainContent
                    isVisible={isActiveTerminalTab}
                    // Why: a background tab with a pending startup must still measure its grid.
                    measureWhileHidden={
                      shouldMeasureHiddenWorktree ||
                      (!isActiveTerminalTab && pendingStartupByTabId[tab.id] !== undefined)
                    }
                    destination={activityTerminalPortal?.target}
                    restoreFocusOnMove={
                      activityTerminalPortal ? activityTerminalPortal.active : isActiveTerminalTab
                    }
                  >
                    {terminalPane}
                  </RetainedPaneHost>
                )
              })}
            </div>
          )
        })}
    </div>
  )
}
