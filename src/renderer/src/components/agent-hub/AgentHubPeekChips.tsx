import { useMemo } from 'react'
import { FileText, Film, Globe, Image } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { Worktree } from '../../../../shared/worktree/types'
import { agentHubPeekItemsInMessage } from './agent-hub-peek-message-links'
import { openAgentHubPeek, type AgentHubPeekItem } from './agent-hub-peek-store'

function PeekIcon({ item }: { item: AgentHubPeekItem }): React.JSX.Element {
  switch (item.content.kind) {
    case 'web':
      return <Globe aria-hidden className="size-3.5" />
    case 'image':
      return <Image aria-hidden className="size-3.5" />
    case 'pdf':
      return <FileText aria-hidden className="size-3.5" />
    case 'media':
      return <Film aria-hidden className="size-3.5" />
  }
}

/** The pages and files an agent's message points to, each a click away from a Peek. */
export function AgentHubPeekChips({
  text,
  worktree
}: {
  text: string
  worktree: Worktree
}): React.JSX.Element | null {
  const items = useMemo(() => agentHubPeekItemsInMessage(text, worktree), [text, worktree])
  if (items.length === 0) {
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
    </div>
  )
}
