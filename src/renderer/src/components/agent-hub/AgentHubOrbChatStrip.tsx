import { useEffect, useRef, useState } from 'react'
import { AudioLines, Plus, X } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/class-names'
import { isImeOwnedKeyboardEvent } from '@/lib/text-input/ime/ime-composition-keyboard-event'
import type { TerminalAgent } from '../../../../shared/agent-status/identity/terminal-agent'
import { AgentIcon } from '@/components/agent/icons/AgentIcon'
import { AttentionDot } from '../bots/AttentionDot'
import { AGENT_HUB_ORB_HOME_CHAT, type OrbStripChatStatus } from './agent-hub-orb-chat-strip'

export type AgentHubOrbStripTab = {
  id: string
  title: string
  status: OrbStripChatStatus
  /** Live voice is bound to this chat. */
  live: boolean
  /** A worker chat: read-only here. */
  readOnly?: boolean
  /** A worker's agent, shown as its icon. */
  agent?: string
}

function StatusMark({ status }: { status: OrbStripChatStatus }): React.JSX.Element | null {
  if (status === 'attention') {
    return <AttentionDot />
  }
  return status === 'working' ? (
    <span
      aria-label={translate('agentHub.orb.strip.working', 'Working')}
      className="size-1.5 shrink-0 animate-pulse rounded-full bg-status-active"
    />
  ) : null
}

function RenameInput({
  value,
  onDone
}: {
  value: string
  onDone: (next: string | null) => void
}): React.JSX.Element {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => ref.current?.select(), [])
  return (
    <input
      ref={ref}
      defaultValue={value}
      aria-label={translate('agentHub.orb.strip.rename', 'Rename')}
      className="h-5 w-24 rounded border border-border bg-background px-1 text-xs outline-none"
      onBlur={(event) => onDone(event.currentTarget.value.trim() || null)}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (isImeOwnedKeyboardEvent(event)) {
          return
        }
        if (event.key === 'Enter') {
          onDone(event.currentTarget.value.trim() || null)
        } else if (event.key === 'Escape') {
          onDone(null)
        }
      }}
    />
  )
}

/** The chats open in the Orb window: Home first and never closed, side chats beside it. */
export function AgentHubOrbChatStrip({
  tabs,
  activeId,
  limit,
  full,
  onActivate,
  onClose,
  actions
}: {
  tabs: readonly AgentHubOrbStripTab[]
  activeId: string
  limit: number
  /** The strip is full and nothing can leave it; "+" says why. */
  full: boolean
  onActivate: (id: string) => void
  onClose: (id: string) => void
  /** Absent while the Orb sleeps: its chats are only read and closed. */
  actions?: {
    onNew: () => void
    onRename: (id: string, title: string) => void
    onClearHome: () => void
    onOpenAsTab: (id: string) => void
  }
}): React.JSX.Element {
  const [renaming, setRenaming] = useState<string | null>(null)
  const newLabel = full
    ? translate(
        'agentHub.orb.strip.fullHint',
        'Every open chat is busy. Close one or wait for it to finish.'
      )
    : translate('agentHub.orb.strip.new', 'New chat')
  return (
    <div
      data-agent-hub-orb-chat-strip
      className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-1.5"
    >
      <div
        role="tablist"
        className="scrollbar-sleek flex min-w-0 items-center gap-1 overflow-x-auto"
      >
        {tabs.map((tab) => {
          const home = tab.id === AGENT_HUB_ORB_HOME_CHAT
          const active = tab.id === activeId
          return (
            <ContextMenu key={tab.id}>
              <ContextMenuTrigger asChild>
                <span
                  data-agent-hub-orb-strip-tab={tab.id}
                  ref={
                    active
                      ? (el) => el?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
                      : undefined
                  }
                  className={cn(
                    'flex h-7 shrink-0 items-center gap-1 rounded-lg pr-1.5 pl-2 text-xs',
                    active
                      ? 'bg-accent text-foreground'
                      : 'text-muted-foreground hover:bg-foreground/5'
                  )}
                >
                  {renaming === tab.id ? (
                    <RenameInput
                      value={tab.title}
                      onDone={(next) => {
                        setRenaming(null)
                        if (next) {
                          actions?.onRename(tab.id, next)
                        }
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => onActivate(tab.id)}
                      className="flex items-center gap-1"
                    >
                      {tab.readOnly && tab.agent ? (
                        <AgentIcon agent={tab.agent as TerminalAgent} size={12} />
                      ) : null}
                      <span className="max-w-24 truncate">{tab.title}</span>
                      {tab.live ? (
                        <span className="inline-flex items-center gap-0.5 text-2xs text-status-active">
                          <AudioLines aria-hidden className="size-3" />
                          {translate('agentHub.orb.strip.live', 'Live')}
                        </span>
                      ) : null}
                      <StatusMark status={tab.status} />
                    </button>
                  )}
                  {home ? null : (
                    <button
                      type="button"
                      aria-label={translate('agentHub.orb.strip.closeTab', 'Close chat')}
                      onClick={() => onClose(tab.id)}
                      className="grid size-4 place-items-center rounded hover:bg-foreground/10"
                    >
                      <X aria-hidden className="size-2.5" />
                    </button>
                  )}
                </span>
              </ContextMenuTrigger>
              {home && !actions ? null : (
                <ContextMenuContent>
                  {home ? (
                    <ContextMenuItem onSelect={actions?.onClearHome}>
                      {translate('agentHub.orb.strip.clearHome', 'Clear home chat')}
                    </ContextMenuItem>
                  ) : (
                    <>
                      {actions ? (
                        <>
                          <ContextMenuItem onSelect={() => setRenaming(tab.id)}>
                            {translate('agentHub.orb.strip.rename', 'Rename')}
                          </ContextMenuItem>
                          <ContextMenuItem onSelect={() => actions.onOpenAsTab(tab.id)}>
                            {translate('agentHub.orb.strip.openAsTab', 'Open as tab')}
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                        </>
                      ) : null}
                      <ContextMenuItem onSelect={() => onClose(tab.id)}>
                        {translate('agentHub.orb.strip.closeTab', 'Close chat')}
                      </ContextMenuItem>
                    </>
                  )}
                </ContextMenuContent>
              )}
            </ContextMenu>
          )
        })}
      </div>
      {actions ? (
        <>
          <button
            type="button"
            aria-label={newLabel}
            title={newLabel}
            aria-disabled={full}
            onClick={actions.onNew}
            className={cn(
              'grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-foreground/5',
              full && 'opacity-50'
            )}
          >
            <Plus aria-hidden className="size-3.5" />
          </button>
          <span className="ml-auto shrink-0 pr-1 text-[11px] text-muted-foreground">
            {tabs.length}/{limit}
          </span>
        </>
      ) : null}
    </div>
  )
}
