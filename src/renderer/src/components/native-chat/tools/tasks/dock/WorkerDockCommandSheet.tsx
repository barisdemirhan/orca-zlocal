import { useContext, useEffect, useId, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslate } from '@/i18n/use-translate'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import { NativeChatSubagentSheet } from '../../../subagents/NativeChatSubagentSheet'
import { NativeChatSubagentSheetHost } from '../../../subagents/NativeChatSubagentSheetLayer'
import { SubagentElapsed } from '../../../subagents/NativeChatSubagentRun'
import { NATIVE_CHAT_SUBAGENT_SHEET_CLOSE_ATTRIBUTE } from '../../../subagents/native-chat-open-subagent'
import { NativeChatBackgroundTaskRun } from '../NativeChatBackgroundTaskRun'
import { returnWorkerDockFocus, workerDockOpenerPane } from './worker-dock-focus-return'
import {
  lastOutputLines,
  workerDockCommandDetail,
  type WorkerDockCommandDetail
} from './worker-dock-command-detail'
import { useWorkerDockCommandOutputFile } from './use-worker-dock-command-output-file'
import { workerDockStateLabel } from './worker-dock-labels'
import { workerDockRowTitle, type WorkerDockRowView } from './WorkerDockRow'
import {
  isSettledBackgroundTaskState,
  normalizeBackgroundTaskState
} from '../../../../../../../shared/native-chat/input/task-lists/native-chat-background-task-row'
import type { RuntimeClientTarget } from '../../../../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import type { AgentJournalCursor } from '../../../../../../../shared/agent-session/journal/agent-session-journal-identity'
import type { AgentSessionHistoryResult } from '../../../../../../../shared/agent-session/agent-session-wire'
import type { NativeChatBlock } from '../../../../../../../shared/native-chat/native-chat-types'

const HISTORY_PAGES = 20

/** Reads the session's own history, which local and remote hosts both serve, for the task's block, its call and result. */
function useWorkerDockCommandDetail(
  row: WorkerDockRowView,
  sessionId: string,
  target: RuntimeClientTarget
): WorkerDockCommandDetail | null | undefined {
  // Undefined while the first read runs, so nothing claims the result is missing before it ends.
  const [detail, setDetail] = useState<WorkerDockCommandDetail | null | undefined>(undefined)
  const { providerId, settlement, state } = row
  useEffect(() => {
    let cancelled = false
    const notFound = (): void => {
      if (!cancelled) {
        setDetail((current) => current ?? null)
      }
    }
    void (async () => {
      if (settlement || !providerId) {
        notFound()
        return
      }
      let collected: NativeChatBlock[] = []
      let cursor: AgentJournalCursor | undefined
      for (let page = 0; page < HISTORY_PAGES; page++) {
        const result = await callRuntimeRpc<AgentSessionHistoryResult>(
          target,
          'agentSession.history',
          {
            sessionId,
            direction: cursor ? 'before' : 'tail',
            ...(cursor ? { cursor } : {}),
            limit: 50
          }
        )
        if (cancelled || !result.ok) {
          notFound()
          return
        }
        const older = result.page.items.flatMap((item) =>
          item.body.kind === 'message' ? item.body.blocks : []
        )
        collected = [...older, ...collected]
        const found = workerDockCommandDetail(collected, providerId)
        const oldest = result.page.window.oldest
        const last = !result.page.hasOlder || !oldest
        // The call sits before its result, so once it is found nothing older can change the answer.
        if (found && (found.command !== null || !found.block.parentToolUseId || last)) {
          setDetail(found)
          return
        }
        if (last) {
          notFound()
          return
        }
        cursor = oldest
      }
      notFound()
    })().catch(notFound)
    return () => {
      cancelled = true
    }
  }, [providerId, settlement, state, sessionId, target])
  return detail
}

/** A command's details in its chat pane's own sheet: status, time, the command, and its output once it ends. */
export function WorkerDockCommandSheet({
  row,
  opener,
  paneKey,
  sessionId,
  target,
  worktreeId,
  onClose
}: {
  row: WorkerDockRowView
  opener: HTMLElement
  paneKey: string
  sessionId: string
  target: RuntimeClientTarget
  /** The chat's workspace, which a read of the command's output file is made through. */
  worktreeId?: string | null
  onClose: () => void
}): React.JSX.Element | null {
  const t = useTranslate()
  const titleId = useId()
  const host = useContext(NativeChatSubagentSheetHost)
  const [pane] = useState(() => workerDockOpenerPane(opener))
  const detail = useWorkerDockCommandDetail(row, sessionId, target)
  useEffect(
    () => () => {
      // The pane stays inert until the sheet is gone, so focus goes back a frame later.
      requestAnimationFrame(() => returnWorkerDockFocus(opener, pane))
    },
    [opener, pane]
  )
  const block = detail?.block ?? null
  const settled = block
    ? isSettledBackgroundTaskState(normalizeBackgroundTaskState(block.state))
    : false
  const startedAt = block?.startedAt ?? row.startedAt
  const counting = !settled && (row.state === 'running' || row.state === 'starting')
  const transcriptOutput = detail?.output && !counting ? lastOutputLines(detail.output) : null
  const file = useWorkerDockCommandOutputFile({
    target,
    worktreeId,
    outputFile: detail && !detail.output ? block?.outputFile : undefined,
    settled: !counting
  })
  const fileLines = file ? lastOutputLines(file.text) : null
  const fileOutput = fileLines?.text
    ? { ...fileLines, unknownOmitted: file?.truncated === true }
    : null
  const output = transcriptOutput ? { ...transcriptOutput, unknownOmitted: false } : fileOutput
  if (!host) {
    return null
  }
  return (
    <NativeChatSubagentSheet
      paneKey={paneKey}
      agentId={row.id}
      titleId={titleId}
      onClose={onClose}
      onEscape={onClose}
    >
      <div className="flex shrink-0 items-start gap-2 border-b border-border/60 py-2 pr-2 pl-4">
        <div className="min-w-0 flex-1">
          <div className="flex h-6 min-w-0 items-center text-chat-foreground-strong">
            <span id={titleId} className="min-w-0 truncate font-semibold">
              {workerDockRowTitle(row)}
            </span>
          </div>
          <div className="h-4 min-w-0 truncate text-xs text-chat-foreground-faint tabular-nums">
            {workerDockStateLabel(t, row.state)}
            {startedAt !== null && startedAt !== undefined ? (
              <span aria-hidden={counting || undefined}>
                {' · '}
                <SubagentElapsed
                  startedAt={startedAt}
                  settledAt={block?.settledAt ?? row.changedAt}
                  counting={counting}
                />
              </span>
            ) : null}
          </div>
        </div>
        <Button
          {...{ [NATIVE_CHAT_SUBAGENT_SHEET_CLOSE_ATTRIBUTE]: '' }}
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t('components.native-chat.workerDock.close', 'Close')}
          onClick={onClose}
        >
          <X aria-hidden className="size-4" />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 scrollbar-sleek overflow-y-auto px-4 py-3 text-sm">
        {block ? (
          <NativeChatBackgroundTaskRun block={block} />
        ) : detail === null || row.reason ? (
          <p className="text-muted-foreground">
            {row.reason ??
              t('components.native-chat.workerDock.resultUnavailable', 'Worker result unavailable')}
          </p>
        ) : null}
        {detail?.command ? (
          <section className="flex flex-col gap-1">
            <h3 className="text-xs font-medium text-chat-foreground-faint">
              {t('components.native-chat.workerDock.commandText', 'Command')}
            </h3>
            <pre className="font-mono text-xs break-all whitespace-pre-wrap text-chat-foreground">
              {detail.command}
            </pre>
          </section>
        ) : null}
        {row.kind !== 'agent' && row.kind !== 'worker' ? (
          <section className="flex flex-col gap-1">
            <h3 className="text-xs font-medium text-chat-foreground-faint">
              {t('components.native-chat.workerDock.commandOutput', 'Output')}
            </h3>
            {output ? (
              <pre className="font-mono text-xs break-all whitespace-pre-wrap text-chat-foreground">
                {output.unknownOmitted
                  ? `${t(
                      'components.native-chat.workerDock.commandOutputEarlier',
                      '… earlier output'
                    )}\n${output.text}`
                  : output.omitted > 0
                    ? `${t(
                        'components.native-chat.workerDock.commandOutputOmitted',
                        '… {{count}} earlier lines',
                        {
                          count: output.omitted,
                          defaultValue_one: '… {{count}} earlier line'
                        }
                      )}\n${output.text}`
                    : output.text}
              </pre>
            ) : counting || detail !== undefined ? (
              <p className="text-xs text-muted-foreground">
                {counting
                  ? t(
                      'components.native-chat.workerDock.commandOutputWhenDone',
                      'The output shows here when the command finishes.'
                    )
                  : t(
                      'components.native-chat.workerDock.commandOutputNone',
                      'No output is recorded in this chat.'
                    )}
              </p>
            ) : null}
          </section>
        ) : null}
      </div>
    </NativeChatSubagentSheet>
  )
}
