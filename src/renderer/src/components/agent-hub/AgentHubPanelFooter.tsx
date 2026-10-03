import { ShortcutKeyCombo } from '@/components/ShortcutKeyCombo'
import { translate } from '@/i18n/i18n'

function Hint({ keys, label }: { keys: string[]; label: string }): React.JSX.Element {
  return (
    <span className="inline-flex items-center gap-1">
      <ShortcutKeyCombo keys={keys} />
      {label}
    </span>
  )
}

export function AgentHubPanelFooter(): React.JSX.Element {
  const isMac = navigator.userAgent.includes('Mac')
  const alt = isMac ? '⌥' : 'Alt'
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
      <Hint keys={['↑↓']} label={translate('agentHub.footer.move', 'Move')} />
      <Hint keys={['↵']} label={translate('agentHub.footer.open', 'Open')} />
      <Hint keys={[alt, '↵']} label={translate('agentHub.footer.popOut', 'Pop out')} />
      <Hint keys={['1–9']} label={translate('agentHub.footer.answer', 'Answer')} />
      <Hint keys={[isMac ? '⇥' : 'Tab']} label={translate('agentHub.footer.tabs', 'Tabs')} />
    </div>
  )
}
