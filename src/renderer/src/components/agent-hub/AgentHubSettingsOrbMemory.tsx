import { useState } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host/execution-host'
import type { GlobalSettings } from '../../../../shared/settings/global-settings-types'
import { Button } from '../ui/button'
import { SettingsRow, SettingsSwitchRow } from '../settings/form-controls/SettingsFormControls'
import { useAgentHubOrbIdentityFiles } from './use-agent-hub-orb-identity-files'

export function AgentHubSettingsOrbMemory({
  settings,
  updateSettings,
  orbDirectory
}: {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
  orbDirectory: string
}): React.JSX.Element {
  const { files, forget } = useAgentHubOrbIdentityFiles()
  const [confirmingAll, setConfirmingAll] = useState(false)
  const suggestions = settings.agentHubOrbMemorySuggestions !== false
  const entries = files?.memory ?? []
  const run = (line: string | null): void => {
    forget(line).then(
      () => setConfirmingAll(false),
      () => toast.error(translate('agentHub.orb.identity.saveFailed', 'Could not save. Try again.'))
    )
  }
  return (
    <>
      <SettingsSwitchRow
        label={translate('agentHub.orb.memory.suggest', 'Suggest memories')}
        description={translate(
          'agentHub.orb.memory.suggestHint',
          'Orb may propose lasting facts about you or your work. Nothing is saved until you accept it.'
        )}
        checked={suggestions}
        onChange={() => {
          updateSettings({ agentHubOrbMemorySuggestions: !suggestions })
          void window.api.app.refreshAgentHubOrbInstructions().catch(() => {})
        }}
      />
      <SettingsRow
        alignTop
        className="flex-col items-stretch"
        label={translate('agentHub.orb.memory.title', 'Memory')}
        description={
          files?.truncated
            ? translate(
                'agentHub.orb.memory.truncated',
                'Memory is too long to send in full. The oldest entries are left out.'
              )
            : undefined
        }
        control={
          <div className="space-y-2">
            {entries.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {translate(
                  'agentHub.orb.memory.empty',
                  'Nothing remembered yet. Accepted proposals appear here.'
                )}
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {entries.map((entry) => (
                  <li key={entry.line} className="flex items-start gap-2 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="select-text break-words text-sm">{entry.text}</p>
                      {entry.date ? (
                        <p className="text-xs text-muted-foreground">{entry.date}</p>
                      ) : null}
                    </div>
                    <Button type="button" variant="ghost" size="xs" onClick={() => run(entry.line)}>
                      {translate('agentHub.orb.memory.forget', 'Forget')}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={!orbDirectory}
                onClick={() =>
                  void window.api.shell.openPath(orbDirectory, LOCAL_EXECUTION_HOST_ID)
                }
              >
                {translate('agentHub.orb.openFolder', 'Open folder')}
              </Button>
              {entries.length > 0 && !confirmingAll ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setConfirmingAll(true)}
                >
                  {translate('agentHub.orb.memory.forgetAll', 'Forget all…')}
                </Button>
              ) : null}
              {confirmingAll ? (
                <>
                  <span className="text-xs text-muted-foreground">
                    {translate('agentHub.orb.memory.confirmAll', 'Forget every memory?')}
                  </span>
                  <Button type="button" variant="destructive" size="xs" onClick={() => run(null)}>
                    {translate('agentHub.orb.memory.confirmForgetAll', 'Forget all')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => setConfirmingAll(false)}
                  >
                    {translate('agentHub.orb.memory.cancel', 'Cancel')}
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        }
      />
    </>
  )
}
