import { useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import type { AgentHubLineage } from './agent-hub-lineage'
import { AGENT_HUB_MIRROR_TAB_CAP } from './agent-hub-mirror-membership'
import {
  agentHubMirrorTabCapReason,
  addAgentHubMirrorTabWithFeedback
} from './agent-hub-mirror-tab-actions'
import { paneTargetFromTerminalRow } from './agent-hub-pane-target'
import { AgentHubMirrorPickerBody } from './AgentHubMirrorPickerBody'
import { startAgentInAgentHubMirror } from './agent-hub-mirror-new-agent'
import { AgentHubNewAgentDialog } from './AgentHubNewAgentDialog'
import type { Worktree } from '../../../../shared/worktree/types'
import type { TuiAgent } from '../../../../shared/agent-launch/catalog/tui-agent'

export function AgentHubMirrorAddButton({
  windowId,
  count,
  threads,
  lineage
}: {
  windowId: string
  count: number
  threads: readonly AgentPaneThread[]
  lineage: AgentHubLineage
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [dialog, setDialog] = useState<{ worktree: Worktree; agent: TuiAgent | null } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const addedRef = useRef(false)
  const launchingRef = useRef(false)
  const [pending, setPending] = useState(false)
  const full = count >= AGENT_HUB_MIRROR_TAB_CAP
  const label = full
    ? agentHubMirrorTabCapReason()
    : translate('agentHub.mirror.addHint', 'Add terminal to this mirror')
  const startAgent = (worktree: Worktree, agent: TuiAgent, fromDialog = false): void => {
    if (launchingRef.current) {
      return
    }
    launchingRef.current = true
    setPending(true)
    void startAgentInAgentHubMirror(windowId, worktree, agent).then((started) => {
      launchingRef.current = false
      setPending(false)
      if (started) {
        addedRef.current = true
        setOpen(false)
      } else if (fromDialog) {
        // A failed start reopens the dialog with the same choices so a retry is one keystroke.
        setDialog({ worktree, agent })
      } else {
        setOpen(true)
      }
    })
  }
  return (
    <>
      <Popover
        open={open && !full}
        onOpenChange={(value) => {
          setOpen(value)
          if (value) {
            setQuery('')
            addedRef.current = false
          }
        }}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="flex shrink-0"
              tabIndex={full ? 0 : undefined}
              aria-label={full ? label : undefined}
            >
              <PopoverTrigger asChild>
                <Button
                  ref={triggerRef}
                  variant="outline"
                  size="icon-sm"
                  disabled={full}
                  aria-label={label}
                >
                  <Plus />
                </Button>
              </PopoverTrigger>
            </span>
          </TooltipTrigger>
          <TooltipContent respectReducedMotion>{label}</TooltipContent>
        </Tooltip>
        <PopoverContent
          align="start"
          collisionPadding={{ top: 8, bottom: 32, left: 8, right: 8 }}
          surface="panel"
          wheelScroll
          respectReducedMotion
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            searchRef.current?.focus()
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            // Radix would refocus the page after a failed launch reopens the picker.
            if (!addedRef.current && !dialog) {
              triggerRef.current?.focus({ preventScroll: true })
            }
          }}
          onEscapeKeyDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
            if (query) {
              setQuery('')
            } else {
              setOpen(false)
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation()
            }
          }}
          className="w-152 max-w-[calc(100vw-2rem)]"
        >
          <AgentHubMirrorPickerBody
            windowId={windowId}
            pending={pending}
            onStart={startAgent}
            onOpenNewAgent={(worktree) => {
              setDialog({ worktree, agent: null })
              setOpen(false)
            }}
            threads={threads}
            lineage={lineage}
            query={query}
            onQueryChange={setQuery}
            searchRef={searchRef}
            onClose={() => setOpen(false)}
            onAdd={(row) => {
              if (
                addAgentHubMirrorTabWithFeedback(windowId, paneTargetFromTerminalRow(row))
                  .status === 'changed'
              ) {
                addedRef.current = true
                setOpen(false)
              }
            }}
          />
        </PopoverContent>
      </Popover>
      {dialog ? (
        <AgentHubNewAgentDialog
          worktree={dialog.worktree}
          initialAgent={dialog.agent}
          pending={pending}
          onStart={(worktree, agent) => startAgent(worktree, agent, true)}
          onClose={() => setDialog(null)}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            if (!launchingRef.current) {
              triggerRef.current?.focus({ preventScroll: true })
            }
          }}
        />
      ) : null}
    </>
  )
}
