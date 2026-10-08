import { translate } from '@/i18n/i18n'
import { HubKeys } from './AgentHubInlineLabels'

function Hint({ keys, label }: { keys: string[]; label: string }): React.JSX.Element {
  return (
    <span className="flex items-center gap-1.5">
      <HubKeys keys={keys} />
      {label}
    </span>
  )
}

export function agentHubPopoutKeys(): string[] {
  return navigator.userAgent.includes('Mac') ? ['⌥↵'] : ['Alt', '↵']
}

export function AgentHubPanelFooter(): React.JSX.Element {
  const isMac = navigator.userAgent.includes('Mac')
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground/70">
      <Hint keys={['↑↓']} label={translate('agentHub.footer.move', 'move')} />
      <Hint keys={['↵']} label={translate('agentHub.footer.jump', 'jump')} />
      <Hint keys={agentHubPopoutKeys()} label={translate('agentHub.footer.popOut', 'pop out')} />
      <Hint keys={['1–9']} label={translate('agentHub.footer.answer', 'answer')} />
      <Hint keys={[isMac ? '⇥' : 'Tab']} label={translate('agentHub.footer.tabs', 'tabs')} />
      <span className="ml-auto">
        <Hint keys={['esc']} label={translate('agentHub.footer.close', 'close')} />
      </span>
    </div>
  )
}
