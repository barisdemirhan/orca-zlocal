import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { GlobalSettings } from '../../../../shared/settings/global-settings-types'
import type { AgentHubOrbConversation } from '../../../../shared/agent-hub-orb'
import { AgentHubOrbHistory } from './AgentHubOrbHistory'
import { AgentHubSettingsOrbSection } from './AgentHubSettingsOrbSection'

/** The panel's non-chat views: the reopen or history failure row, past conversations and settings. */
export function AgentHubOrbSecondaryViews({
  sessionId,
  busy,
  error,
  failure,
  history,
  settingsView,
  conversations,
  settings,
  updateSettings,
  reopen,
  refresh
}: {
  sessionId: string
  busy: boolean
  error: boolean
  failure: { message: string; resumeId?: string } | null
  history: boolean
  settingsView: boolean
  conversations: readonly AgentHubOrbConversation[]
  settings: GlobalSettings | null
  updateSettings: (updates: Partial<GlobalSettings>) => void
  reopen: (resumeId?: string) => Promise<void>
  refresh: () => Promise<void>
}): React.JSX.Element {
  return (
    <>
      {error || failure ? (
        <div
          role="status"
          className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground"
        >
          {failure?.message ??
            translate(
              'auto.agentHub.orb.historyFailed',
              'Could not load conversations. Try again.'
            )}
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => {
              if (failure) {
                void reopen(failure.resumeId)
              } else {
                void refresh()
              }
            }}
          >
            {translate('common.retry', 'Retry')}
          </Button>
        </div>
      ) : null}
      {history ? (
        <AgentHubOrbHistory
          conversations={conversations}
          activeSessionId={sessionId}
          busy={busy}
          onReopen={(id) => {
            void reopen(id)
          }}
        />
      ) : null}
      {settingsView && settings ? (
        <section
          aria-label={translate('auto.agentHub.orb.settings', 'Orb settings')}
          className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto p-3"
        >
          <AgentHubSettingsOrbSection settings={settings} updateSettings={updateSettings} />
        </section>
      ) : null}
    </>
  )
}
