import { useTranslate } from '@/i18n/use-translate'
import type { AgentSessionPluginStatus } from '../../../../../../shared/agent-session/plugin-surfaces/agent-session-plugin-surface-wire'

export function NativeChatPluginStatusRow({
  statuses
}: {
  statuses: readonly AgentSessionPluginStatus[] | undefined
}): React.JSX.Element | null {
  const t = useTranslate()
  if (!statuses?.length) {
    return null
  }
  return (
    <ul
      aria-label={t('components.native-chat.pluginStatus.label', 'Plugin status')}
      className="flex min-w-0 flex-wrap items-center gap-x-3 px-3 text-2xs text-chat-foreground-faint"
    >
      {statuses.map(({ plugin, text }) => (
        <li
          key={plugin}
          title={`${plugin}: ${text}`}
          className="flex min-w-0 max-w-full items-baseline gap-1"
        >
          <span className="shrink-0 opacity-70">{plugin}</span>
          <span className="min-w-0 truncate whitespace-nowrap">{text}</span>
        </li>
      ))}
    </ul>
  )
}
