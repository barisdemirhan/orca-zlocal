import { Lock, Moon } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import { openOrchestrationWorker } from '@/lib/open-orchestration-worker'
import { botTarget } from '@/lib/bot-hosts'
import { closeAgentHubOrbSideChat } from './agent-hub-orb-side-chat'
import { openAgentHubOrb } from './agent-hub-orb-open'
import { useAgentHubOrbComposerMode } from './use-agent-hub-orb-composer-mode'
import { useAgentHubOrbBot } from './use-agent-hub-orb-bot'

/** The bar itself: a note and one action, with the worker's footer under it. */
export function AgentHubOrbReadOnlyBarView({
  kind,
  onAction
}: {
  kind: 'worker' | 'asleep'
  onAction: () => void
}): React.JSX.Element {
  const worker = kind === 'worker'
  return (
    <div data-agent-hub-orb-readonly-bar={kind} className="shrink-0 px-3 pb-1">
      <div className="flex min-h-10 items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs">
        {worker ? (
          <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        ) : (
          <Moon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <span className="min-w-0 flex-1 text-muted-foreground">
          {worker
            ? translate(
                'agentHub.orb.worker.talkInTerminal',
                'Talk to this worker in its terminal.'
              )
            : translate('agentHub.orb.asleep.note', 'Asleep · chats stay readable')}
        </span>
        <Button type="button" variant={worker ? 'outline' : 'default'} size="xs" onClick={onAction}>
          {worker
            ? translate('agentHub.orb.worker.openAsTab', 'Open as tab')
            : translate('agentHub.orb.asleep.wake', 'Wake')}
        </Button>
      </div>
      {worker ? (
        <div className="mt-1 flex h-5.5 items-center px-0.5 text-2xs text-chat-foreground-faint">
          {translate('agentHub.orb.worker.footer', 'Worker · read only')}
        </div>
      ) : null}
    </div>
  )
}

/** Stands where the composer would be for a worker's chat or a sleeping Orb; there is no input to type into. */
export function AgentHubOrbReadOnlyBar({ tabId }: { tabId: string }): React.JSX.Element | null {
  const mode = useAgentHubOrbComposerMode(tabId)
  const bot = useAgentHubOrbBot()
  if (mode.kind === 'none') {
    return null
  }
  return (
    <AgentHubOrbReadOnlyBarView
      kind={mode.kind}
      onAction={() => {
        if (mode.kind === 'asleep') {
          void openAgentHubOrb()
          return
        }
        closeAgentHubOrbSideChat(mode.chatId)
        if (bot) {
          openOrchestrationWorker(
            {
              dispatchId: mode.worker.dispatchId,
              title: mode.title,
              worktreeId: mode.worker.worktreeId,
              chatSessionId: null
            },
            botTarget(bot)
          )
        }
      }}
    />
  )
}
