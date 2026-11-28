import { AgentHubMicModeMenuRow } from './AgentHubMicModeMenuRow'
import { useEffect, useState } from 'react'
import { Mic, Settings } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { SwitchIndicator } from '@/components/ui/switch'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import type { SpeechModelManifest } from '../../../../shared/speech/speech-types'
import { agentHubVoiceModelChoices } from './agent-hub-mirror-mic-state'
import {
  openAgentHubVoiceSettings,
  toggleAgentHubVoiceDictation,
  updateAgentHubVoiceSettings
} from './agent-hub-voice-settings'
import { useMenuOpeningClickGuard } from './use-menu-opening-click-guard'

// The catalog does not change while the app runs; every mirror's menu shares one copy.
let speechCatalog: readonly SpeechModelManifest[] = []

function useSpeechCatalog(): readonly SpeechModelManifest[] {
  const [catalog, setCatalog] = useState(speechCatalog)
  useEffect(() => {
    let cancelled = false
    void window.api.speech
      .getCatalog()
      .then((next) => {
        speechCatalog = next
        if (!cancelled) {
          setCatalog(next)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  return catalog
}

/**
 * Right-click on a mirror's microphone: the voice options worth reaching without leaving the
 * window. Turning dictation on, picking among the downloaded speech models, and the way to the
 * rest in Settings.
 */
export function AgentHubMirrorMicMenu({
  children,
  onOpenChange,
  canImprove
}: {
  children: React.ReactNode
  onOpenChange?: (open: boolean) => void
  canImprove: boolean
}): React.JSX.Element {
  const voiceEnabled = useAppStore((s) => s.settings?.voice?.enabled === true)
  const sttModel = useAppStore((s) => s.settings?.voice?.sttModel)
  const modelStates = useAppStore((s) => s.modelStates)
  const refreshModelStates = useAppStore((s) => s.refreshModelStates)
  const catalog = useSpeechCatalog()
  const [permissionPending, setPermissionPending] = useState(false)
  const openingClick = useMenuOpeningClickGuard()
  // Why on mount too: the button reads these to know whether the selected model is downloaded.
  useEffect(() => {
    void refreshModelStates()
  }, [refreshModelStates])
  const { choices, more } = agentHubVoiceModelChoices(catalog, modelStates, sttModel)
  const pick =
    (run: (event: Event) => void) =>
    (event: Event): void => {
      if (openingClick.isOpeningClick()) {
        event.preventDefault()
        return
      }
      run(event)
    }
  return (
    <ContextMenu
      onOpenChange={(open) => {
        openingClick.noteOpenChange(open)
        if (open) {
          void refreshModelStates()
        }
        onOpenChange?.(open)
      }}
    >
      <ContextMenuTrigger asChild>
        <span className="contents">{children}</span>
      </ContextMenuTrigger>
      <ContextMenuContent
        className="w-max min-w-80 max-w-[calc(100vw-2rem)]"
        data-agent-hub-mirror-mic-menu
      >
        {canImprove ? (
          <>
            <AgentHubMicModeMenuRow isOpeningClick={openingClick.isOpeningClick} />
            <ContextMenuSeparator />
          </>
        ) : null}
        <ContextMenuItem
          role="menuitemcheckbox"
          aria-checked={voiceEnabled}
          disabled={permissionPending}
          onSelect={pick((event) => {
            // The switch flips in place; the menu stays for the model list under it.
            event.preventDefault()
            void toggleAgentHubVoiceDictation(setPermissionPending)
          })}
        >
          <Mic />
          {translate('agentHub.mic.enable', 'Voice dictation')}
          <SwitchIndicator checked={voiceEnabled} size="compact" className="ml-auto" />
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuLabel>{translate('agentHub.mic.model', 'Speech model')}</ContextMenuLabel>
        {choices.length > 0 ? (
          <ContextMenuRadioGroup value={sttModel ?? ''}>
            {choices.map((choice) => (
              <ContextMenuRadioItem
                key={choice.id}
                value={choice.id}
                onSelect={pick(() => updateAgentHubVoiceSettings({ sttModel: choice.id }))}
              >
                {choice.label}
              </ContextMenuRadioItem>
            ))}
          </ContextMenuRadioGroup>
        ) : (
          <ContextMenuItem disabled>
            {translate('agentHub.mic.noModels', 'No downloaded models')}
          </ContextMenuItem>
        )}
        {more ? (
          <ContextMenuItem inset onSelect={pick(openAgentHubVoiceSettings)}>
            {translate('agentHub.mic.moreModels', 'More in settings…')}
          </ContextMenuItem>
        ) : null}
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={pick(openAgentHubVoiceSettings)}>
          <Settings />
          {translate('agentHub.mic.settings', 'Voice settings…')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
