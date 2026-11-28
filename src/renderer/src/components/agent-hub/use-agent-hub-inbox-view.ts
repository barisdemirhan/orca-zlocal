import { useEffect, useMemo, useRef, useState } from 'react'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import type { AgentHubCardControl } from './AgentHubAttentionCard'
import type {
  AgentHubInboxItem,
  AgentHubInboxItemGroup,
  AgentHubInboxModel
} from './agent-hub-inbox-model'
import { agentHubInboxSenderName } from './agent-hub-inbox-sender'
import {
  nextAgentHubSideChoice,
  readAgentHubPanelListState,
  updateAgentHubPanelListState,
  useAgentHubPanelListState
} from './agent-hub-panel-list-state'
import { useAgentHubHeldInbox } from './use-agent-hub-held-inbox'

const ANSWERED_LINGER_MS = 1800

export type AgentHubAnsweredGhost = { id: string; side: 'bots' | 'agents'; name: string }

/** An ask that left the Inbox shows "Answered" for 1.8 s before its row goes. */
function useAnsweredGhosts(model: AgentHubInboxModel): AgentHubAnsweredGhost[] {
  const known = useRef(new Map<string, AgentHubAnsweredGhost>())
  const [ghosts, setGhosts] = useState<AgentHubAnsweredGhost[]>([])
  useEffect(() => {
    const now = new Map<string, AgentHubAnsweredGhost>()
    for (const box of model.boxes) {
      for (const group of box.groups) {
        for (const ask of group.asks) {
          now.set(ask.id, { id: ask.id, side: box.side, name: agentHubInboxSenderName(group) })
        }
      }
    }
    for (const entry of model.hiddenEntries) {
      now.set(entry.id, { id: entry.id, side: entry.side, name: '' })
    }
    const gone = [...known.current.values()].filter((ghost) => !now.has(ghost.id) && ghost.name)
    known.current = now
    if (gone.length === 0) {
      return
    }
    setGhosts((current) => [...current, ...gone])
    const timer = setTimeout(
      () => setGhosts((current) => current.filter((ghost) => !gone.includes(ghost))),
      ANSWERED_LINGER_MS
    )
    return () => clearTimeout(timer)
  }, [model])
  return ghosts
}

export type AgentHubInboxView = {
  boxes: AgentHubInboxModel['boxes']
  selectedKey: string | null
  isOpen: (key: string) => boolean
  /** The question a sender shows as a card: the one picked, else its oldest; null when folded. */
  activeAskId: (group: AgentHubInboxItemGroup) => string | null
  activateAsk: (group: AgentHubInboxItemGroup, entryId: string, fold: boolean) => void
  select: (key: string) => void
  toggle: (key: string) => void
  ghosts: AgentHubAnsweredGhost[]
  /** Handles an Inbox key; true when it did. */
  onKey: (event: React.KeyboardEvent) => boolean
  /** The panel-level Inbox keys: 1-9 answer, then onKey; false lets the tab keys run. */
  onPanelKey: (event: React.KeyboardEvent) => boolean
  controlRef: React.RefObject<AgentHubCardControl | null>
  /** The selected sender's thread, for the pop-out shortcut. */
  selectedThread: AgentPaneThread | null
}

export function useAgentHubInboxView(
  model: AgentHubInboxModel,
  rootRef: React.RefObject<HTMLElement | null>,
  actions: {
    /** An entry id (or a pane key) whose sender starts selected. */
    initialEntryId?: string | null
    onLater: (entry: AgentHubInboxItem) => void
    onMarkRead: (entries: AgentHubInboxItem[]) => void
    onOpenEntry: (entry: AgentHubInboxItem, popout: boolean) => void
    onSearch: () => void
  }
): AgentHubInboxView {
  const listState = useAgentHubPanelListState()
  const held = useAgentHubHeldInbox(model, rootRef)
  const [selectedKey, setSelectedKey] = useState<string | null>(() => {
    const wanted = actions.initialEntryId
    if (!wanted) {
      return null
    }
    for (const box of model.boxes) {
      for (const group of box.groups) {
        const all = [...group.asks, ...group.fails, ...group.results]
        if (all.some((entry) => entry.id === wanted || entry.id === `thread:${wanted}`)) {
          return group.key
        }
      }
    }
    return null
  })
  const controlRef = useRef<AgentHubCardControl>(null)
  const openedEntry = useRef(actions.initialEntryId ?? null)
  useEffect(() => {
    const wanted = openedEntry.current
    openedEntry.current = null
    const group = model.boxes
      .flatMap((box) => box.groups)
      .find((candidate) =>
        candidate.asks.some((ask) => ask.id === wanted || ask.id === `thread:${wanted}`)
      )
    const ask = group?.asks.find((entry) => entry.id === wanted || entry.id === `thread:${wanted}`)
    if (group && ask) {
      updateAgentHubPanelListState({
        activeAsks: new Map(readAgentHubPanelListState().activeAsks).set(group.key, ask.id)
      })
    }
  }, [model])
  const ghosts = useAnsweredGhosts(model)
  const boxes = useMemo(
    () => held.filter((box) => listState.side === 'both' || listState.side === box.side),
    [held, listState.side]
  )
  const navKeys = boxes.flatMap((box) =>
    listState.foldedBoxes.has(box.side) ? [] : box.groups.map((group) => group.key)
  )
  const groupOf = (key: string | null) =>
    boxes.flatMap((box) => box.groups).find((group) => group.key === key) ?? null
  // Why bound to the key: a new row sorting in must not move the selection to another sender.
  const activeKey = selectedKey !== null && navKeys.includes(selectedKey) ? selectedKey : null
  // Why open by default: the questions show without opening the sender.
  const isOpen = (key: string): boolean => listState.openGroups.get(key) ?? true
  const activeAskOf = (group: AgentHubInboxItemGroup | null): AgentHubInboxItem | null => {
    if (!group) {
      return null
    }
    const picked = listState.activeAsks.get(group.key)
    if (picked === '') {
      return null
    }
    return group.asks.find((ask) => ask.id === picked) ?? group.asks[0] ?? null
  }
  const setOpen = (key: string, open: boolean): void =>
    updateAgentHubPanelListState({ openGroups: new Map(listState.openGroups).set(key, open) })

  const onKey = (event: React.KeyboardEvent): boolean => {
    if (event.metaKey || event.ctrlKey) {
      return false
    }
    const group = groupOf(activeKey)
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        const delta = event.key === 'ArrowDown' ? 1 : -1
        const at = activeKey === null ? -1 : navKeys.indexOf(activeKey)
        const next =
          at < 0
            ? delta > 0
              ? 0
              : navKeys.length - 1
            : Math.max(0, Math.min(navKeys.length - 1, at + delta))
        setSelectedKey(navKeys[next] ?? null)
        return true
      }
      case 'ArrowRight':
      case 'ArrowLeft':
        if (activeKey === null) {
          return false
        }
        setOpen(activeKey, event.key === 'ArrowRight')
        return true
      case 'b':
      case 'B':
        updateAgentHubPanelListState({
          side: nextAgentHubSideChoice(listState.side, model.botsActive)
        })
        return true
      case 'l':
      case 'L': {
        const ask = activeAskOf(group)
        if (ask) {
          actions.onLater(ask)
        }
        return ask !== null
      }
      case 'e':
      case 'E':
        if (group && group.results.length + group.fails.length > 0) {
          actions.onMarkRead([...group.fails, ...group.results])
          return true
        }
        return false
      case '/':
        actions.onSearch()
        return true
      case 'Enter': {
        const entry = activeAskOf(group) ?? group?.fails[0] ?? group?.results[0]
        if (entry) {
          actions.onOpenEntry(entry, event.altKey)
          return true
        }
        return false
      }
      default:
        return false
    }
  }

  return {
    boxes,
    selectedKey: activeKey,
    isOpen,
    activeAskId: (group) => activeAskOf(group)?.id ?? null,
    activateAsk: (group, entryId, fold) =>
      updateAgentHubPanelListState({
        activeAsks: new Map(listState.activeAsks).set(group.key, fold ? '' : entryId)
      }),
    select: setSelectedKey,
    toggle: (key) => setOpen(key, !isOpen(key)),
    ghosts,
    onKey,
    onPanelKey: (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null
      const onButton =
        target !== null && target !== event.currentTarget && target.closest('button') !== null
      if (/^[1-9]$/.test(event.key) && !event.altKey && !event.metaKey && !event.ctrlKey) {
        if (controlRef.current?.chooseOption(Number(event.key) - 1)) {
          event.preventDefault()
        }
        return true
      }
      if (!(event.key === 'Enter' && onButton) && onKey(event)) {
        event.preventDefault()
        return true
      }
      return false
    },
    controlRef,
    selectedThread: (() => {
      const payload = activeAskOf(groupOf(activeKey))?.payload
      return payload?.type === 'thread' ? payload.thread : null
    })()
  }
}
