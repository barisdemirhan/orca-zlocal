import { useTranslate } from '@/i18n/use-translate'
import type {
  AgentSessionPluginNode,
  AgentSessionPluginStatus,
  AgentSessionPluginUiPress
} from '../../../../../../shared/agent-session/plugin-surfaces/agent-session-plugin-surface-wire'
import { NativeChatPluginTree } from '../../plugin-surfaces/NativeChatPluginTree'

export function NativeChatPluginStatusRow({
  statuses,
  hint,
  onPress
}: {
  statuses: readonly AgentSessionPluginStatus[] | undefined
  /** A mod's drawn prompt hint, shown in the same row as the status lines. */
  hint?: AgentSessionPluginNode
  onPress?: (press: AgentSessionPluginUiPress) => void
}): React.JSX.Element | null {
  const t = useTranslate()
  if (!statuses?.length && !(hint && onPress)) {
    return null
  }
  return (
    <ul
      aria-label={t('components.native-chat.pluginStatus.label', 'Plugin status')}
      className="flex min-w-0 flex-wrap items-center gap-x-3 px-3 text-2xs text-chat-foreground-faint"
    >
      {hint && onPress ? (
        <li className="flex min-w-0 max-w-full items-center">
          <NativeChatPluginTree
            node={hint}
            target={{ component: 'PromptHint', instanceId: 'prompt-hint' }}
            onPress={onPress}
          />
        </li>
      ) : null}
      {statuses?.map(({ plugin, text }) => (
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
