import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { openBotHomeWithOutcome } from '@/lib/bot-catalog'
import { botTarget } from '@/lib/bot-hosts'
import { selectExecutionHostDisplayLabel } from '@/runtime/hosts/display/execution-host-display-label'
import { runtimeTargetEnvironmentId } from '@/runtime/rpc/targets/runtime-client-target'
import { useAppStore } from '@/store'
import type { WorkspaceActivationOutcome } from '@/lib/workspace/activation/worktree-activation-outcome'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host/execution-host'
import type { Bot } from '../../../../shared/bot-types'
import { closeAgentHubCanvas } from './agent-hub-canvas-store'

function showBotHomeWithOutcome(bot: Bot): WorkspaceActivationOutcome {
  const outcome = openBotHomeWithOutcome(bot)
  if ('opened' in outcome) {
    // The canvas covers the page and snaps the right sidebar back; its guard only leaves on a switch.
    closeAgentHubCanvas()
  }
  return outcome
}

/** The bot's page in the main view, the canvas closed over it; false when its home can't open. */
export function showBotHome(bot: Bot): boolean {
  return 'opened' in showBotHomeWithOutcome(bot)
}

function botPageUnavailableMessage(bot: Bot): string {
  if (bot.hostId === LOCAL_EXECUTION_HOST_ID) {
    return translate(
      'agentHub.mirror.bot.pageUnavailable',
      '{{name}}’s home isn’t available here now, so its page can’t open.',
      { name: bot.name }
    )
  }
  return translate(
    'agentHub.mirror.bot.pageUnavailableOnHost',
    '{{name}}’s home on {{host}} isn’t available now, so its page can’t open. Reconnect {{host}}, then try again.',
    { name: bot.name, host: selectExecutionHostDisplayLabel(useAppStore.getState(), bot.hostId) }
  )
}

/** As `showBotHome`; a home not listed yet gets one re-read of its host, then a notice if it still can't open. */
export async function openBotPage(bot: Bot): Promise<boolean> {
  const first = showBotHomeWithOutcome(bot)
  if ('opened' in first) {
    return true
  }
  if (first.refused.failureNotified) {
    return false
  }
  await useAppStore
    .getState()
    .fetchFolderWorkspaces({ runtimeEnvironmentId: runtimeTargetEnvironmentId(botTarget(bot)) })
    .catch((error: unknown) => console.error('Failed to read the bot’s workspaces:', error))
  const retry = showBotHomeWithOutcome(bot)
  if ('opened' in retry) {
    return true
  }
  if (!retry.refused.failureNotified) {
    toast.error(botPageUnavailableMessage(bot))
  }
  return false
}
