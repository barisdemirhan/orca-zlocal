import { CheckCheck } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { AgentHubAwayAnswers } from './AgentHubAwayAnswers'
import { AgentHubInboxSection } from './AgentHubInboxSection'
import type { AgentHubInboxEntryContext } from './AgentHubInboxEntryView'
import { showAgentHubHiddenEntries, type AgentHubInboxModel } from './agent-hub-inbox-model'
import {
  updateAgentHubPanelListState,
  useAgentHubPanelListState
} from './agent-hub-panel-list-state'
import type { AgentHubInboxView } from './use-agent-hub-inbox-view'

/** The Inbox: a foldable Bots box and a foldable Agents box, each grouped by sender. */
export function AgentHubInboxList({
  model,
  view,
  context,
  workingCount
}: {
  model: AgentHubInboxModel
  view: AgentHubInboxView
  context: AgentHubInboxEntryContext
  workingCount: number
}): React.JSX.Element {
  const { foldedBoxes } = useAgentHubPanelListState()
  const groups = view.boxes.flatMap((box) => box.groups)
  const empty = groups.every(
    (group) => group.asks.length + group.fails.length + group.results.length === 0
  )
  const onlySuggestions = groups.length > 0
  return (
    <>
      {empty && model.hidden === 0 && view.ghosts.length === 0 ? (
        <div className="flex flex-col items-center gap-1 px-2.5 pt-5.5 pb-4.5 text-center text-xs text-muted-foreground">
          <CheckCheck className="mb-1 size-5 text-status-success" />
          <b className="text-[13px] font-medium text-foreground/85">
            {translate('agentHub.inbox.emptyTitle', 'Nobody is waiting on you')}
          </b>
          {onlySuggestions ? (
            <span>
              {translate('agentHub.inbox.onlySuggestions', 'Only suggestions, folded below')}
            </span>
          ) : null}
          <span>
            {translate(
              'agentHub.inbox.emptyHint',
              "{{value0}} working · you'll get a ping when one asks",
              {
                value0:
                  workingCount === 1
                    ? translate('agentHub.inbox.oneAgent', '1 agent')
                    : translate('agentHub.inbox.agents', '{{value0}} agents', {
                        value0: workingCount
                      })
              }
            )}
          </span>
        </div>
      ) : null}
      {view.boxes.map((box) =>
        box.groups.length === 0 ? null : (
          <div key={box.side}>
            <AgentHubInboxSection
              side={box.side}
              groups={box.groups}
              folded={foldedBoxes.has(box.side)}
              onToggleFold={() => {
                const next = new Set(foldedBoxes)
                if (!next.delete(box.side)) {
                  next.add(box.side)
                }
                updateAgentHubPanelListState({ foldedBoxes: next })
              }}
              view={view}
              context={context}
            />
            {view.ghosts
              .filter((ghost) => ghost.side === box.side)
              .map((ghost) => (
                <div
                  key={ghost.id}
                  data-agent-hub-answered
                  className="px-2 py-1.5 text-xs text-status-success"
                >
                  {translate('agentHub.inbox.answeredBy', 'Answered · {{name}}', {
                    name: ghost.name
                  })}
                </div>
              ))}
          </div>
        )
      )}
      <AgentHubAwayAnswers presentationOf={context.presentationOf} />
      {model.hidden > 0 ? (
        <button
          type="button"
          tabIndex={-1}
          data-agent-hub-hidden-cards
          onClick={() => showAgentHubHiddenEntries(model.hiddenEntries)}
          className="mt-1.5 w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground"
        >
          {translate('agentHub.inbox.hidden', '{{value0}} hidden · Show', {
            value0: model.hidden
          })}
        </button>
      ) : null}
    </>
  )
}
