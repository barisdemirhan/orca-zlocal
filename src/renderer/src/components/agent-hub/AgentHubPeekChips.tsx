import { useMemo } from 'react'
import { FileText, Film, Globe, Image } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { Worktree } from '../../../../shared/worktree/types'
import { agentHubPeekItemsInMessage } from './agent-hub-peek-message-links'
import { agentHubPeekRefusalReason } from './agent-hub-peek-refusal'
import { openAgentHubPeek, type AgentHubPeekItem } from './agent-hub-peek-store'
const NO_LINKS: readonly string[] = []

function PeekIcon({ item }: { item: AgentHubPeekItem }): React.JSX.Element {
  switch (item.content.kind) {
    case 'web':
      return <Globe aria-hidden className="size-3.5" />
    case 'image':
      return <Image aria-hidden className="size-3.5" />
    case 'pdf':
    case 'markdown':
    case 'csv':
    case 'mermaid':
    case 'notebook':
    case 'text':
      return <FileText aria-hidden className="size-3.5" />
    case 'media':
      return <Film aria-hidden className="size-3.5" />
  }
}

/** The pages and files an agent's message points to, each a click away from a Peek. */
export function AgentHubPeekChips({
  text,
  worktree,
  links = NO_LINKS
}: {
  text: string
  worktree?: Worktree | null
  links?: readonly string[]
}): React.JSX.Element | null {
  const items = useMemo(() => {
    if (!worktree) {
      return []
    }
    const linked = links.flatMap((link) => agentHubPeekItemsInMessage(link, worktree))
    const found = [...linked, ...agentHubPeekItemsInMessage(text, worktree)]
    return [...new Map(found.map((item) => [item.location, item])).values()]
  }, [text, links, worktree])
  const unavailable = [...new Set(links)].filter(
    (link) => !worktree || agentHubPeekItemsInMessage(link, worktree).length === 0
  )
  if (items.length === 0 && unavailable.length === 0) {
    return null
  }
  return (
    <div
      className="mt-2 flex flex-wrap gap-1"
      aria-label={translate('agentHub.peek.chips', 'Links in this message')}
    >
      {items.map((item) => (
        <Button
          key={item.location}
          type="button"
          variant="outline"
          size="xs"
          title={item.location}
          aria-label={translate('agentHub.peek.chipLabel', 'Peek at {{value0}}', {
            value0: item.title
          })}
          onClick={() => openAgentHubPeek(item)}
        >
          <PeekIcon item={item} />
          <span className="max-w-48 truncate">{item.title}</span>
        </Button>
      ))}
      {unavailable.map((link) => (
        <Button
          key={link}
          type="button"
          variant="outline"
          size="xs"
          disabled
          title={agentHubPeekRefusalReason(link)}
          aria-label={translate('agentHub.peek.chipLabel', 'Peek at {{value0}}', { value0: link })}
        >
          {/^https?:\/\//i.test(link) ? (
            <Globe aria-hidden className="size-3.5" />
          ) : (
            <FileText aria-hidden className="size-3.5" />
          )}
          <span className="max-w-48 truncate">{link}</span>
        </Button>
      ))}
    </div>
  )
}
