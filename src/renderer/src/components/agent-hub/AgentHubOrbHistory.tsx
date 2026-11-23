import { useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/class-names'
import { getIntlLocale, translate } from '@/i18n/i18n'
import { structuredAgentLabel } from '@/lib/agent-session/launch/structured-agent-session-launch-label'
import type { AgentHubOrbConversation } from '../../../../shared/agent-hub-orb'
import { useNow } from '@/lib/window-activity/use-now'
import { openArchivedAgentHubOrbChat } from './agent-hub-orb-archived-chat'

function dayKey(time: number): string {
  const date = new Date(time)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

export function AgentHubOrbHistory({
  conversations,
  activeSessionId,
  busy,
  onReopen
}: {
  conversations: readonly AgentHubOrbConversation[]
  activeSessionId: string
  busy: boolean
  onReopen: (sessionId: string) => void
}): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [agent, setAgent] = useState<AgentHubOrbConversation['agent'] | null>(null)
  const agents = useMemo(
    () => [...new Set(conversations.map((entry) => entry.agent))],
    [conversations]
  )
  const now = useNow(60_000)
  const today = dayKey(now)
  const yesterdayDate = new Date(now)
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterday = dayKey(yesterdayDate.getTime())
  const untitled = translate('agentHub.orb.newConversationTitle', 'New conversation')
  const groups = new Map<string, AgentHubOrbConversation[]>()
  for (const conversation of conversations) {
    if (agent && agents.includes(agent) && conversation.agent !== agent) {
      continue
    }
    const search =
      `${conversation.title || untitled} ${conversation.lastReply ?? ''}`.toLocaleLowerCase()
    if (!search.includes(query.trim().toLocaleLowerCase())) {
      continue
    }
    const key = dayKey(conversation.lastActiveAt)
    const group = groups.get(key) ?? []
    group.push(conversation)
    groups.set(key, group)
  }
  const searchLabel = translate('auto.agentHub.orb.searchConversations', 'Search conversations')
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-agent-hub-orb-history>
      <div className="space-y-2 border-b border-border p-3">
        <Input
          type="search"
          autoFocus
          aria-label={searchLabel}
          placeholder={searchLabel}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="flex flex-wrap gap-1">
          <Button
            type="button"
            size="xs"
            variant={agent === null || !agents.includes(agent) ? 'secondary' : 'ghost'}
            aria-pressed={agent === null || !agents.includes(agent)}
            onClick={() => setAgent(null)}
          >
            {translate('auto.agentHub.orb.allAgents', 'All agents')}
          </Button>
          {agents.map((id) => (
            <Button
              key={id}
              type="button"
              size="xs"
              variant={agent === id ? 'secondary' : 'ghost'}
              aria-pressed={agent === id}
              onClick={() => setAgent(id)}
            >
              {structuredAgentLabel(id)}
            </Button>
          ))}
        </div>
      </div>
      <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto p-2">
        {[...groups].map(([key, entries]) => (
          <section key={key}>
            <h3 className="px-2 pt-3 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              {key === today
                ? translate('auto.agentHub.orb.today', 'Today')
                : key === yesterday
                  ? translate('auto.agentHub.orb.yesterday', 'Yesterday')
                  : new Date(entries[0].lastActiveAt).toLocaleDateString(getIntlLocale(), {
                      dateStyle: 'medium'
                    })}
            </h3>
            {entries.map((entry) => (
              <button
                key={entry.sessionId}
                type="button"
                disabled={busy}
                data-current={entry.sessionId === activeSessionId}
                aria-current={entry.sessionId === activeSessionId ? 'true' : undefined}
                className={cn(
                  'flex w-full flex-col gap-1 rounded-md px-3 py-2 text-left outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
                  entry.sessionId === activeSessionId && 'bg-accent text-accent-foreground'
                )}
                onClick={() =>
                  entry.archivedWorkspaceId
                    ? openArchivedAgentHubOrbChat(entry.sessionId, entry.archivedWorkspaceId)
                    : onReopen(entry.sessionId)
                }
              >
                <span className="flex w-full items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {entry.title || untitled}
                  </span>
                  <time
                    dateTime={new Date(entry.lastActiveAt).toISOString()}
                    className="shrink-0 text-xs text-muted-foreground"
                  >
                    {new Date(entry.lastActiveAt).toLocaleString(
                      getIntlLocale(),
                      key === today ? { hour: '2-digit', minute: '2-digit' } : { weekday: 'short' }
                    )}
                  </time>
                  {entry.sessionId === activeSessionId ? <Check className="size-3" /> : null}
                </span>
                <span className="w-full truncate text-xs text-muted-foreground">
                  {structuredAgentLabel(entry.agent)}
                  {entry.archivedWorkspaceId
                    ? ` · ${translate('auto.agentHub.orb.archivedBeforeBot', 'Before the Orb bot')}`
                    : ''}
                  {entry.lastReply ? ` · ${entry.lastReply}` : ''}
                </span>
              </button>
            ))}
          </section>
        ))}
        {groups.size === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">
            {translate('auto.agentHub.orb.noConversations', 'No conversations found')}
          </p>
        ) : null}
      </div>
    </div>
  )
}
