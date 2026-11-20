// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, render as renderBase, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { AgentJournalRenderItem } from '../../../../shared/agent-session/journal/agent-session-journal-types'
import type { NativeChatSpokenProvenance } from '../../../../shared/native-chat/native-chat-types'
import { projectStructuredItemToNativeChat } from '../../../../shared/agent-session/view/structured-agent-session-projection'
import { MessageRow } from './messages/rows/NativeChatMessageRow'
import { NativeChatPresentationContext } from './native-chat-presentation-context'
import { TooltipProvider } from '@/components/ui/tooltip'

const render = (ui: React.ReactElement) => renderBase(ui, { wrapper: TooltipProvider })

afterEach(cleanup)

function message(role: 'user' | 'assistant', text: string, spoken?: NativeChatSpokenProvenance) {
  const item: AgentJournalRenderItem = {
    itemId: text,
    revision: 1,
    sequence: 1,
    observedAt: 1_000,
    body: {
      kind: 'message',
      role,
      blocks: [{ type: 'text', text }],
      ...(spoken ? { spoken } : {})
    }
  }
  const projected = projectStructuredItemToNativeChat(item)
  if (!projected) {
    throw new Error('Message projection must preserve transcript text')
  }
  return projected
}

describe('spoken provenance on native chat message rows', () => {
  it.each(['user', 'assistant'] as const)(
    'labels only canonical spoken %s messages in Orb and follows the retained context back to Chat',
    (role) => {
      const spoken = message(role, 'A spoken transcript', {
        provider: 'codex',
        threadId: 'thread-1',
        realtimeSessionId: 'voice-1',
        itemId: 'spoken-1'
      })
      const typed = message(role, 'A typed message')
      const rows = (
        <>
          <MessageRow message={spoken} expandSignal={false} onScrollMessageToTop={() => {}} />
          <MessageRow message={typed} expandSignal={false} onScrollMessageToTop={() => {}} />
        </>
      )
      const view = render(
        <NativeChatPresentationContext value="orb">{rows}</NativeChatPresentationContext>
      )
      expect(screen.getAllByRole('img', { name: 'Spoken message' })).toHaveLength(1)
      const transcript = screen.getByText('A spoken transcript')
      expect(screen.getByText('A typed message')).toBeInTheDocument()

      view.rerender(
        <NativeChatPresentationContext value="chat">{rows}</NativeChatPresentationContext>
      )
      expect(screen.queryByRole('img', { name: 'Spoken message' })).not.toBeInTheDocument()
      expect(screen.getByText('A spoken transcript')).toBe(transcript)
      expect(screen.getByText('A typed message')).toBeInTheDocument()

      view.rerender(
        <NativeChatPresentationContext value="orb">{rows}</NativeChatPresentationContext>
      )
      expect(screen.getAllByRole('img', { name: 'Spoken message' })).toHaveLength(1)
    }
  )
})
