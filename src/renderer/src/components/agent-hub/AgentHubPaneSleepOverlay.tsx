import { useState } from 'react'
import { translate } from '@/i18n/i18n'
import { TerminalSleepingPaneOverlay } from '../terminal-pane/session-restore/spawn-deferral/TerminalSleepingPaneOverlay'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import { useAgentHubPaneSleep } from './agent-hub-pane-sleep'

export function AgentHubPaneSleepOverlay({
  target
}: {
  target: AgentHubPaneTarget
}): React.JSX.Element | null {
  const state = useAgentHubPaneSleep(target)
  const [error, setError] = useState<string | undefined>()
  if (state.phase === 'awake') {
    return null
  }
  const pending = state.phase === 'sleeping-pending' || state.phase === 'waking'
  const unavailable = state.phase === 'unverifiable'
  const title = unavailable
    ? translate('agentHub.sleep.unverifiable', 'Host unavailable')
    : state.phase === 'waking'
      ? translate('agentHub.sleep.waking', 'Waking…')
      : pending
        ? translate('agentHub.sleep.pending', 'Putting to sleep…')
        : translate('agentHub.sleep.group', 'Sleeping')
  const detail = unavailable
    ? translate(
        'agentHub.sleep.verifyDetail',
        'Reconnect to the execution host to verify this pane’s state.'
      )
    : pending
      ? translate(
          'agentHub.sleep.transitionDetail',
          'Waiting for the execution host to confirm the change…'
        )
      : state.kind === 'agent'
        ? translate(
            'agentHub.sleep.savedDetail',
            'The agent session is saved. Wake it here to resume.'
          )
        : translate(
            'agentHub.sleep.pausedDetail',
            'Processes are paused. CPU use has stopped; memory is retained.'
          )
  return (
    <TerminalSleepingPaneOverlay
      reason="paused"
      presentation={{
        title,
        detail: state.reason ?? detail,
        pending,
        disabled: pending,
        action: unavailable
          ? translate('common.retry', 'Retry')
          : translate('agentHub.sleep.wake', 'Wake'),
        error: error ?? state.error
      }}
      onResume={() => {
        setError(undefined)
        void (unavailable ? state.recheck() : state.wake()).catch((failure: unknown) =>
          setError(
            failure instanceof Error
              ? failure.message
              : translate('agentHub.sleep.wakeFailed', 'Could not wake this pane. Try again.')
          )
        )
      }}
    />
  )
}
