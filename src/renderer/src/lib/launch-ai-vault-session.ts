import { useAppStore } from '@/store'
import { persistAgentLaunchTabOrder } from '@/lib/agent-session/launch/pane/launch-agent-tab-order'
import { tuiAgentToAgentKind } from '@/lib/telemetry'
import { runtimeEnvironmentIdOrLocalUnlessTwin } from '@/lib/workspace/ownership/worktree-runtime-owner'
import { createWebRuntimeSessionTerminal } from '@/runtime/web-runtime-terminal-creation'
import { createWebRuntimeSessionTerminalResult } from '@/runtime/web-runtime-terminal-create-operation'
import { isWebRuntimeSessionActive } from '@/runtime/web-runtime-session-environment'
import { webTerminalPlacementParentTabId } from '@/runtime/web-session-terminal-placement'
import { toWebTerminalSurfaceTabId } from '../../../shared/workspace-layout/terminal-surface-id'
import type { AiVaultAgent } from '../../../shared/ai-vault/contracts/ai-vault-types'
import type {
  AgentProviderSessionMetadata,
  SleepingAgentLaunchConfig
} from '../../../shared/agent-session/lifecycle/agent-session-resume'
import type { TabSplitDirection } from '@/store/slices/tabs'
import type { WebRuntimeTerminalCreateOutcome } from '@/runtime/web-runtime-session-types'

export type LaunchAiVaultSessionInNewTabResult =
  | { tabId: string }
  | {
      tabId: null
      runtimeLaunch: Promise<WebRuntimeTerminalCreateOutcome>
      /** Only for an inactive launch, whose caller shows the tab itself. */
      runtimeTabId?: Promise<string | null>
    }

export function launchAiVaultSessionInNewTab(args: {
  agent: AiVaultAgent
  worktreeId: string
  command: string
  cwd?: string
  env?: Record<string, string>
  envToDelete?: string[]
  launchConfig?: SleepingAgentLaunchConfig
  providerSession?: AgentProviderSessionMetadata
  targetGroupId?: string
  splitDirection?: TabSplitDirection
  /** false leaves the workspace showing what it shows; the caller places the new tab. */
  activate?: false
}): LaunchAiVaultSessionInNewTabResult {
  const store = useAppStore.getState()
  // Why both paths split: the runtime path used to return first and drop the split (#22791).
  const split =
    args.splitDirection && args.targetGroupId
      ? { sourceGroupId: args.targetGroupId, splitDirection: args.splitDirection }
      : undefined
  const runtimeEnvironmentId = runtimeEnvironmentIdOrLocalUnlessTwin(store, args.worktreeId)
  if (isWebRuntimeSessionActive(runtimeEnvironmentId)) {
    // Why an empty group first: the paired host creates the tab after a round trip.
    const splitGroupId = split
      ? store.createEmptySplitGroup(args.worktreeId, split.sourceGroupId, split.splitDirection)
      : null
    const targetGroupId = splitGroupId ?? args.targetGroupId
    const terminal = {
      worktreeId: args.worktreeId,
      environmentId: runtimeEnvironmentId,
      ...(targetGroupId ? { targetGroupId } : {}),
      agentSessionKind: 'resume' as const,
      launchAgent: args.agent,
      command: args.command,
      ...(args.cwd ? { cwd: args.cwd } : {}),
      ...(args.env ? { env: args.env } : {}),
      ...(args.envToDelete ? { envToDelete: args.envToDelete } : {}),
      ...(args.launchConfig ? { launchConfig: args.launchConfig } : {}),
      ...(args.providerSession ? { providerSession: args.providerSession } : {}),
      ...(args.launchConfig ? { agentArgs: args.launchConfig.agentArgs } : {})
    }
    if (args.activate === false) {
      const created = createWebRuntimeSessionTerminalResult({
        ...terminal,
        activate: false,
        selectWorktree: false
      })
      return {
        tabId: null,
        runtimeLaunch: created.then((result) => result.outcome),
        runtimeTabId: created.then((result) =>
          result.hostTabId
            ? toWebTerminalSurfaceTabId(webTerminalPlacementParentTabId(result.hostTabId))
            : null
        )
      }
    }
    const runtimeLaunch = createWebRuntimeSessionTerminal(
      { ...terminal, activate: true },
      { notifyFailure: false }
    )
    const observedRuntimeLaunch = runtimeLaunch.then((outcome) => {
      if (outcome.status === 'created') {
        useAppStore.getState().setActiveTabType('terminal', args.worktreeId)
      } else if (splitGroupId) {
        // A refused or failed drop must not leave a blank pane behind.
        useAppStore.getState().closeEmptyGroup(args.worktreeId, splitGroupId)
      }
      return outcome
    })
    return { tabId: null, runtimeLaunch: observedRuntimeLaunch }
  }

  const tab = store.createTab(args.worktreeId, args.targetGroupId, undefined, {
    ...(split ? { split } : {}),
    ...(args.cwd ? { startupCwd: args.cwd } : {}),
    ...(args.activate === false ? { activate: false } : {}),
    pendingStartup: {
      command: args.command,
      ...(args.env ? { env: args.env } : {}),
      ...(args.envToDelete ? { envToDelete: args.envToDelete } : {}),
      ...(args.launchConfig ? { launchConfig: args.launchConfig, launchAgent: args.agent } : {}),
      ...(args.providerSession ? { resumeProviderSession: args.providerSession } : {}),
      telemetry: {
        agent_kind: tuiAgentToAgentKind(args.agent),
        launch_source: 'sidebar',
        request_kind: 'resume'
      }
    }
  })
  if (args.activate !== false) {
    store.setActiveTabType('terminal', args.worktreeId)
  }

  persistAgentLaunchTabOrder(args.worktreeId, tab.id)

  return { tabId: tab.id }
}
