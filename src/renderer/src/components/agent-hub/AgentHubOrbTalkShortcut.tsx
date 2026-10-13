import { translate } from '@/i18n/i18n'
import { SettingsRow } from '../settings/SettingsFormControls'
import { ShortcutRecorderButton } from '../settings/ShortcutRecorderButton'
import { ShortcutRemoveButton } from '../settings/ShortcutRemoveButton'
import type { AgentHubShortcutEditor } from './use-agent-hub-shortcut-editor'

export function AgentHubOrbTalkShortcut({
  editor
}: {
  editor: AgentHubShortcutEditor
}): React.JSX.Element {
  const actionId = 'agentHub.toggleOrb'
  const title = translate('auto.agentHub.orb.talkShortcut', 'Talk shortcut')
  const bindings = editor.bindingsFor(actionId)
  return (
    <div className="space-y-1">
      <SettingsRow
        label={title}
        control={
          <div className="flex flex-wrap items-center gap-1">
            {bindings.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                {translate('auto.agentHub.orb.notSet', 'Not set')}
              </span>
            ) : null}
            {[...bindings, null].map((binding, index) => (
              <div key={binding ?? 'append'} className="flex items-center gap-1">
                <ShortcutRecorderButton
                  actionId={actionId}
                  title={title}
                  platform={editor.platform}
                  isDigitIndex={false}
                  binding={binding}
                  bindingIndex={index}
                  bindingCount={bindings.length}
                  isAppendSlot={binding === null}
                  recording={
                    editor.recordingActionId === actionId && editor.recordingBindingIndex === index
                  }
                  onStartRecording={editor.startRecording}
                  onCancelRecording={editor.cancelRecording}
                  onCapture={(id, input) => void editor.capture(id, input)}
                  onClearError={editor.clearError}
                />
                {binding !== null ? (
                  <ShortcutRemoveButton
                    actionId={actionId}
                    title={title}
                    bindingIndex={index}
                    onRemove={editor.remove}
                  />
                ) : null}
              </div>
            ))}
          </div>
        }
      />
      {editor.errors[actionId] ? (
        <p role="alert" className="text-xs text-destructive">
          {editor.errors[actionId]}
        </p>
      ) : null}
    </div>
  )
}
