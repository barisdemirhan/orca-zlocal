import { MicVocal, Settings } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { normalizeAgentHubMicMode } from '../../../../shared/agent-hub-settings'
import { Button } from '../ui/button'
import { ContextMenuItem } from '../ui/context-menu'
import { SwitchIndicator } from '../ui/switch'
import { AgentHubShortcut } from './AgentHubShortcut'
import { readAgentHubDictationCapabilities } from './agent-hub-dictation-capabilities'
import { openAgentHubVoiceSettings } from './agent-hub-voice-settings'

export function AgentHubMicModeMenuRow({
  isOpeningClick
}: {
  isOpeningClick: () => boolean
}): React.JSX.Element {
  const improve = useAppStore(
    (s) => normalizeAgentHubMicMode(s.settings?.agentHubMicMode) === 'improve'
  )
  const updateSettings = useAppStore((s) => s.updateSettings)
  return (
    <div className="flex items-center gap-1">
      <ContextMenuItem
        className="flex-1 whitespace-nowrap"
        role="menuitemcheckbox"
        aria-checked={improve}
        onSelect={(event) => {
          event.preventDefault()
          if (!isOpeningClick() && (improve || readAgentHubDictationCapabilities().improve)) {
            void updateSettings({ agentHubMicMode: improve ? 'dictate' : 'improve' })
          }
        }}
      >
        <MicVocal />
        {translate('agentHub.mic.improveWithAgent', 'Improve with an agent')}
        <SwitchIndicator checked={improve} size="compact" className="ml-auto" />
      </ContextMenuItem>
      <ContextMenuItem
        asChild
        onSelect={(event) => {
          if (isOpeningClick()) {
            event.preventDefault()
            return
          }
          openAgentHubVoiceSettings()
        }}
      >
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={translate('agentHub.mic.improveSettings', 'Improve transcription settings')}
        >
          <Settings />
        </Button>
      </ContextMenuItem>
      <AgentHubShortcut
        actionId={improve ? 'voice.dictationImprove' : 'voice.dictation'}
        slot="context"
      />
    </div>
  )
}
