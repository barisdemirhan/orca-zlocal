import { translate } from '@/i18n/i18n'
import { KEYBINDING_DEFINITIONS } from '../../../../shared/keybindings/definitions'
import { formatKeybindingList } from '../../../../shared/keybindings/formatting'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { ShortcutRecorderButton } from '../settings/shortcuts/ShortcutRecorderButton'
import { ShortcutRemoveButton } from '../settings/shortcuts/ShortcutRemoveButton'
import { AGENT_HUB_SUGGESTED_BINDINGS } from './agent-hub-shortcut-suggestions'
import {
  useAgentHubShortcutEditor,
  type AgentHubShortcutEditor
} from './use-agent-hub-shortcut-editor'

/** Shares the global shortcut recorder and save path inside the Hub dialog. */
export function AgentHubShortcutSetting(): React.JSX.Element {
  const editor = useAgentHubShortcutEditor()
  return <AgentHubShortcutEditorRows editor={editor} />
}

function AgentHubShortcutEditorRows({
  editor
}: {
  editor: AgentHubShortcutEditor
}): React.JSX.Element {
  const missing = AGENT_HUB_SUGGESTED_BINDINGS.filter(
    ([actionId]) => editor.bindingsFor(actionId).length === 0
  )
  const applySuggested = async (): Promise<void> => {
    const next = { ...editor.keybindings }
    for (const [actionId, binding] of missing) {
      next[actionId] = [binding]
    }
    if (
      !editor.checkConflicts(
        missing.map(([actionId]) => actionId),
        next
      )
    ) {
      return
    }
    editor.cancelRecording()
    for (const [actionId, binding] of missing) {
      if (!(await editor.saveBindings(actionId, [binding]))) {
        break
      }
    }
  }
  return (
    <div className="min-w-0 space-y-3 py-3" data-agent-hub-shortcuts>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label>
          {translate('auto.components.settings.ExperimentalPane.agentHub.shortcuts', 'Shortcuts')}
        </Label>
        {missing.length > 0 ? (
          <Button type="button" variant="outline" size="xs" onClick={() => void applySuggested()}>
            {translate(
              'auto.components.settings.ExperimentalPane.agentHub.useSuggested',
              'Use these'
            )}
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {translate(
          'agentHub.shortcut.doubleTapHint',
          'You can also record a double tap of a modifier key.'
        )}
      </p>
      {missing.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {translate(
            'agentHub.shortcut.suggestions',
            'Suggested for missing bindings: {{bindings}}',
            {
              bindings: formatKeybindingList(
                missing.map(([, binding]) => binding),
                editor.platform
              )
            }
          )}
        </p>
      ) : null}
      {KEYBINDING_DEFINITIONS.filter(
        (action) =>
          action.id.startsWith('agentHub.') ||
          ['voice.dictation', 'voice.dictationImprove'].includes(action.id)
      ).map(({ id: actionId }) => {
        const definition = editor.catalog.definitionsByAction.get(actionId)
        if (!definition) {
          return null
        }
        const bindings = editor.bindingsFor(actionId)
        const slots = [...bindings, null]
        return (
          <div key={actionId} className="space-y-1" data-agent-hub-shortcut={actionId}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 text-xs">{definition.title}</span>
              <div className="flex max-w-full flex-wrap items-center justify-end gap-1">
                {slots.map((binding, index) => (
                  <div key={binding ?? 'append'} className="flex items-center gap-1">
                    <ShortcutRecorderButton
                      actionId={actionId}
                      title={definition.title}
                      platform={editor.platform}
                      isDigitIndex={false}
                      binding={binding}
                      bindingIndex={index}
                      bindingCount={bindings.length}
                      isAppendSlot={binding === null}
                      recording={
                        editor.recordingActionId === actionId &&
                        editor.recordingBindingIndex === index
                      }
                      onStartRecording={editor.startRecording}
                      onCancelRecording={editor.cancelRecording}
                      onCapture={(id, input) => void editor.capture(id, input)}
                      onClearError={editor.clearError}
                    />
                    {binding !== null ? (
                      <ShortcutRemoveButton
                        actionId={actionId}
                        title={definition.title}
                        bindingIndex={index}
                        onRemove={editor.remove}
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
            {editor.errors[actionId] ? (
              <p role="alert" className="text-xs text-destructive">
                {editor.errors[actionId]}
              </p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
