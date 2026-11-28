import { useEffect } from 'react'
import type { AgentSessionPluginPromptFill } from '../../../../../shared/agent-session/plugin-surfaces/agent-session-plugin-surface-wire'
import { structuredAgentSessionDraftScopeKey } from '../drafts/native-chat-draft-scope'
import { nativeChatComposerScopeDestination } from '../composer/focus/native-chat-composer-destination'
import { insertNativeChatComposerDraftText } from '../drafts/native-chat-composer-draft-insertion'
import { readNativeChatComposerDraft } from '../drafts/native-chat-composer-draft-store'

const REMEMBERED_FILL_IDS = 200

// Module-wide so the main pane and a floating mirror of one chat apply a fill once.
const appliedFillIds = new Set<string>()

function applyFill(scopeKey: string, fill: AgentSessionPluginPromptFill): void {
  // Orca never answers promptRead, so the mod thinks the box is empty: keep what the user typed.
  if (fill.mode === 'replace' && readNativeChatComposerDraft(scopeKey).text.trim() !== '') {
    const mounted = nativeChatComposerScopeDestination(scopeKey)
    if (mounted?.acceptsText()) {
      mounted.appendText(fill.text)
    } else {
      insertNativeChatComposerDraftText(scopeKey, `\n${fill.text}`, { draftOnly: true })
    }
    return
  }
  insertNativeChatComposerDraftText(scopeKey, fill.text)
}

/** Puts each prompt fill a mod asked for into the chat's composer draft, once, and focuses the composer. */
export function useNativeChatPluginPromptFill(
  fills: readonly AgentSessionPluginPromptFill[] | undefined,
  sessionId: string,
  focusComposer: () => void
): void {
  useEffect(() => {
    const scopeKey = structuredAgentSessionDraftScopeKey(sessionId)
    let applied = false
    for (const fill of fills ?? []) {
      if (appliedFillIds.has(fill.id)) {
        continue
      }
      appliedFillIds.add(fill.id)
      if (appliedFillIds.size > REMEMBERED_FILL_IDS) {
        appliedFillIds.delete(appliedFillIds.values().next().value as string)
      }
      applyFill(scopeKey, fill)
      applied = true
    }
    if (applied) {
      focusComposer()
    }
  }, [fills, sessionId, focusComposer])
}
