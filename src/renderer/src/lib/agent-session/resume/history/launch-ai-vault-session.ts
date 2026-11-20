import { useAppStore } from '@/store/index'
import { persistAgentLaunchTabOrder } from '@/lib/agent-session/launch/pane/launch-agent-tab-order'
import '@/diagnostics/telemetry/telemetry'
import { tuiAgentToAgentKind } from '../../../../../../shared/agent-status/identity/agent-kind'
import {
  getKnownExecutionHostIdForWorktree,
  runtimeEnvironmentIdOrLocalUnlessTwin
} from '@/lib/workspace/ownership/worktree-runtime-owner'
import { getSavedTerminalSessionName } from '@/lib/agent-session/history/session-names/terminal-session-names'
import { setWebRuntimeTabProps } from '@/runtime/hosted-terminals/actions/web-runtime-tab-properties'
import { createWebRuntimeSessionTerminal } from '@/runtime/hosted-terminals/creation/web-runtime-terminal-creation'
import { isWebRuntimeSessionActive } from '@/runtime/web-session-tabs-sync/identity/web-runtime-session-environment'
import { createWebRuntimeSessionTerminalResult } from '@/runtime/hosted-terminals/creation/web-runtime-terminal-create-operation'
import { webTerminalPlacementParentTabId } from '@/runtime/hosted-terminals/placement/web-session-terminal-placement'
import { toWebTerminalSurfaceTabId } from '../../../../../../shared/workspace-layout/terminal-surface-id'
import type { AiVaultAgent } from '../../../../../../shared/ai-vault/contracts/ai-vault-types'
import type {
  AgentProviderSessionMetadata,
  SleepingAgentLaunchConfig
} from '../../../../../../shared/agent-session/lifecycle/agent-session-resume'
import type { TabSplitDirection } from '@/store/slices/tabs/tabs-slice-contract'
import type { WebRuntimeTerminalCreateOutcome } from '@/runtime/hosted-terminals/creation/terminal-create-contracts'

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
  const savedName = savedNameForResume(store, args)
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
    // The mirrored tab may not be here yet; name it on its host, which republishes the name.
    const nameMirroredTab = (mirroredTabId: string | null | undefined): void => {
      if (savedName && mirroredTabId) {
        setWebRuntimeTabProps({
          worktreeId: args.worktreeId,
          tabId: mirroredTabId,
          customTitle: savedName
        })
      }
    }
    if (args.activate === false) {
      const created = createWebRuntimeSessionTerminalResult({
        ...terminal,
        activate: false,
        selectWorktree: false
      }).then((result) => {
        if (result.outcome.status === 'created') {
          nameMirroredTab(result.outcome.mirroredTabId)
        }
        return result
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
        nameMirroredTab(outcome.mirroredTabId)
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
  if (savedName) {
    store.setTabCustomTitle(tab.id, savedName, { recordInteraction: false })
  }
  if (args.activate !== false) {
    store.setActiveTabType('terminal', args.worktreeId)
  }

  persistAgentLaunchTabOrder(args.worktreeId, tab.id)

  return { tabId: tab.id }
}

/** A resumed session reopens under the name its tab had (forks carry no provider session, so a
 *  copy is never named after its source). The tab takes over the saved name once it shows it. */
function savedNameForResume(
  state: ReturnType<typeof useAppStore.getState>,
  args: {
    agent: AiVaultAgent
    worktreeId: string
    providerSession?: AgentProviderSessionMetadata
  }
): string | null {
  const sessionId = args.providerSession?.id
  const executionHostId = getKnownExecutionHostIdForWorktree(state, args.worktreeId)
  return sessionId && executionHostId
    ? getSavedTerminalSessionName(executionHostId, args.agent, sessionId)
    : null
}
